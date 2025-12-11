// server.js
// Enhanced AI gate + real login roles + minimal job-room message storage
// Keeps existing functionality intact

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

// Setup OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(cors());
app.use(express.json());

// Simple test route to verify phone ↔ server connection
app.get("/ping", (req, res) => {
    console.log(">>> HIT /ping");
    res.status(200).json({ ok: true, message: "pong" });
  });
  

/* ------------------------------------------------------------------ */
/* AUTH STORE (Temporary until database is added later)                */
/* ------------------------------------------------------------------ */

const users = {}; // { email: { id, email, role, companyId, name, passwordHash } }

/* Job assignments:
   { jobId: { ownerId, employees: [employeeIds] } }
*/
const jobRooms = {};

/* Messages per job room:
   { jobId: [ { senderId, senderName, role, text, createdAt } ] }
*/
const jobMessages = {};

/* ------------------------------------------------------------------ */
/* AI CLEAR CLARITY GATE: /ai-gate  (UNCHANGED)                        */
/* ------------------------------------------------------------------ */

function buildPrompt(message, jobTitle, jobId) {
  return `
You help an electrician employee communicate clearly and safely with their boss Victor about job-site work.

Rules:
- Rewrite their message into clear, calm, professional English.
- Keep the meaning the same but do NOT include pricing, profit, labor hours, invoices, or contracts.
- If danger is mentioned (sparks, burning smell, arcing, overheating), emphasize safety and tell them to shut off the breaker and call Vic immediately.
- Always keep it short (2–4 sentences).
- Start naturally with "Hey Vic,".
- Return only the rewritten message text.
`;
}

app.post("/ai-gate", async (req, res) => {
  try {
    const { message, jobTitle, jobId } = req.body || {};
    if (!message || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Missing message text" });
    }

    const prompt = buildPrompt(message, jobTitle, jobId);
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an assistant helping electricians write safe, clear updates for their boss Vic.",
        },
        { role: "user", content: prompt + `"${message}"` },
      ],
    });

    const aiText = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!aiText) {
      throw new Error("Empty AI response");
    }

    return res.status(200).json({ ok: true, previewText: aiText });
  } catch (err) {
    console.error("AI gate error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* USER SIGNUP + LOGIN  (TWEAKED, AI NOT TOUCHED)                      */
/* ------------------------------------------------------------------ */

app.post("/signup", (req, res) => {
    console.log(">>> HIT /signup", req.body);

  const { email, password, name, role } = req.body || {};

  if (!email?.trim() || !password?.trim() || !name?.trim() || !role?.trim()) {
    return res
      .status(200)
      .json({ ok: false, error: "Missing required signup fields" });
  }

  const lowerEmail = email.toLowerCase();

  // prevent duplicates
  if (users[lowerEmail]) {
    return res
      .status(200)
      .json({ ok: false, error: "User with this email already exists" });
  }

  const id = Math.random().toString(36).slice(2, 10);
  const companyId =
    role === "owner" || role === "independent"
      ? Math.random().toString(36).slice(2, 10)
      : "";

  // Store the user
  users[lowerEmail] = {
    id,
    email: lowerEmail,
    role,
    companyId,
    name,
    passwordHash: password, // bcrypt later
  };

  console.log("Created user:", users[lowerEmail]);

  return res.status(200).json({
    ok: true,
    user: { id, email: lowerEmail, role, companyId, name },
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email?.trim() || !password?.trim()) {
    return res.status(200).json({ ok: false, error: "Missing credentials" });
  }

  const user = users[email.toLowerCase()];

  if (!user) {
    return res.status(200).json({ ok: false, error: "User not found" });
  }

  if (password !== user.passwordHash) {
    return res.status(200).json({ ok: false, error: "Invalid password" });
  }

  return res.status(200).json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      name: user.name,
    },
  });
});

/* ------------------------------------------------------------------ */
/* JOB ASSIGNMENT + ROOM-BASED MESSAGE STORAGE  (UNCHANGED)           */
/* ------------------------------------------------------------------ */

// Owner assigns employees to a job room
app.post("/jobs/:jobId/assign", (req, res) => {
  const { jobId } = req.params;
  const { ownerId, employeeIds } = req.body || {};

  if (!ownerId || !Array.isArray(employeeIds)) {
    return res
      .status(200)
      .json({ ok: false, error: "Invalid assignment payload" });
  }

  jobRooms[jobId] = {
    ownerId,
    employees: employeeIds,
  };

  if (!jobMessages[jobId]) {
    jobMessages[jobId] = [];
  }

  return res.status(200).json({ ok: true });
});

// Fetch messages in a job room
app.get("/jobs/:jobId/messages", (req, res) => {
  const { jobId } = req.params;
  if (!jobMessages[jobId]) {
    jobMessages[jobId] = [];
  }
  return res.status(200).json({ ok: true, messages: jobMessages[jobId] });
});

// Post messages into a job room (AI rewrite happens in frontend before calling this)
app.post("/jobs/:jobId/messages", (req, res) => {
  const { jobId } = req.params;
  const { senderId, senderName, role, text } = req.body || {};

  if (!senderId || !text?.trim()) {
    return res
      .status(200)
      .json({ ok: false, error: "Missing sender or text" });
  }

  if (!jobMessages[jobId]) {
    jobMessages[jobId] = [];
  }

  const messagePayload = {
    senderId,
    senderName,
    role,
    text,
    createdAt: new Date().toISOString(),
  };

  jobMessages[jobId].push(messagePayload);

  return res.status(200).json({ ok: true, message: messagePayload });
});

// Owner fetches all job rooms they have created
app.get("/jobs", (req, res) => {
  return res.status(200).json({ ok: true, jobs: Object.keys(jobRooms) });
});

// Employees fetch ONLY their assigned jobs using their user ID
app.get("/employee/:employeeId/assigned-jobs", (req, res) => {
  const { employeeId } = req.params;
  const assignedJobs = Object.keys(jobRooms).filter((jobId) =>
    jobRooms[jobId].employees?.includes(employeeId)
  );
  return res.status(200).json({ ok: true, jobs: assignedJobs });
});

/* ------------------------------------------------------------------ */
/* EXISTING: ASK TRAKTR AI Q&A  (UNCHANGED)                            */
/* ------------------------------------------------------------------ */

function buildAssistantSystemPrompt(electricianType, jobContext) {
  return `
You are "Traktr AI", a private, safety-first assistant for electricians using the app.

You help with:
- Wiring questions
- Troubleshooting "No Power" or tripping breakers
- Choosing materials (BX/MC, EMT, conductor sizes, breaker sizes)
- Message drafting

Safety rules:
- If any danger is mentioned, stop work, shut off breaker, and contact supervisor immediately.
- Never leak pricing, invoices, or profit details.
- Tell them to check local electrical code when needed.

Style:
- Clear steps
- Short answers
  `;
}

app.post("/ai-assistant", async (req, res) => {
  try {
    const { question, electricianType, jobContext } = req.body || {};

    if (!question || !question.trim()) {
      return res.status(200).json({ ok: false, error: "Missing question text" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: buildAssistantSystemPrompt(electricianType, jobContext),
        },
        { role: "user", content: question.trim() },
      ],
    });

    const answerText = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!answerText) {
      return res.status(200).json({ ok: false, error: "Empty AI response" });
    }

    return res.status(200).json({ ok: true, answerText });
  } catch (err) {
    console.error("Ask Traktr AI internal error:", err);
    return res.status(200).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* START SERVER                                                       */
/* ------------------------------------------------------------------ */

const PORT = 4001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
