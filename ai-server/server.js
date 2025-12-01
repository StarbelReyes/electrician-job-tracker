// server.js
// Simple AI gate for Traktr Team Chat + Ask Traktr AI assistant

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

// Make sure your .env has: OPENAI_API_KEY=sk-xxxx
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(cors());
app.use(express.json());

/* ------------------------------------------------------------------ */
/* TEAM CHAT GATE: /ai-gate (existing behavior)                       */
/* ------------------------------------------------------------------ */

// Helper: build prompt for the electrician AI used in Team Chat rewrite
function buildPrompt(message, jobTitle, jobId) {
  return `
You help an electrician employee communicate clearly and safely with their boss Victor about job-site work.

Rules:
- Rewrite their message into clear, calm, professional English.
- Keep the meaning the same (no guessing about prices or schedule).
- If they mention danger (sparks, burning smell, hot wires), highlight safety and recommend shutting off power and calling the boss right away.
- Always keep it short (2–4 sentences).
- Start naturally with "Hey Vic," or "Hello,"—not both.

Job title: ${jobTitle || "Unknown"}
Job ID: ${jobId || "Unknown"}

Employee raw message:
"${message}"

Rewrite it as a single message to send to Vic:
`;
}

app.post("/ai-gate", async (req, res) => {
  try {
    const { message, jobTitle, jobId } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Missing message text" });
    }

    const prompt = buildPrompt(message, jobTitle, jobId);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // small, fast, cheap
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an assistant helping electricians write clear, safe updates for their boss.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const aiText =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!aiText) {
      throw new Error("Empty AI response from OpenAI");
    }

    // What the app expects
    return res.json({
      ok: true,
      previewText: aiText,
    });
  } catch (err) {
    console.error("AI gate error:", err);
    return res
      .status(500)
      .json({ error: err.message || "AI internal error" });
  }
});

/* ------------------------------------------------------------------ */
/* ASK TRAKTR AI Q&A: /ai-assistant                                   */
/* ------------------------------------------------------------------ */

// Helper: system prompt for Ask Traktr AI
function buildAssistantSystemPrompt(electricianType, jobContext) {
  return `
You are "Traktr AI", a private, safety-first assistant for electricians using the Traktr – Electrician Job Tracker app.

You help with:
- wiring questions
- troubleshooting "no power" or tripping breakers
- choosing materials (EMT vs BX/MC, conductor sizes, breaker sizes, etc.)
- wording messages or emails to clients or bosses

SAFETY RULES:
- Always assume you cannot see the job in person.
- Never give instructions that could reasonably cause shock, fire, or injury.
- If there is any sign of danger (sparks, burning smell, arcing, overheating, burning insulation, water near electrical equipment, damaged conductors):
  - Tell them to stop work, de-energize the circuit, and call their licensed supervisor or a qualified electrician immediately.
- Remind them to:
  - Turn off the correct breaker or disconnect.
  - Lockout/tagout where appropriate.
  - Use an appropriate tester or meter to verify zero voltage before working on conductors.
- Do NOT guess about prices, contracts, or legal code interpretations.
  - You may say things like: "Check your local electrical code (NEC + local amendments)" or "Confirm with your supervisor or inspector."

STYLE:
- Use clear, step-by-step guidance for troubleshooting or wiring.
- Prefer short paragraphs and bullet steps instead of big walls of text.
- If the question is about wording a message/email, return a clean, professional draft they can copy.
- You may ask 1–2 clarifying questions if the situation is ambiguous.

Extra context (may be empty):
- Electrician type: ${electricianType || "Unknown"}
- Job context: ${jobContext || "None provided"}
`.trim();
}

app.post("/ai-assistant", async (req, res) => {
  const startedAt = Date.now();
  console.log(
    `[Ask Traktr AI] /ai-assistant called at ${new Date(
      startedAt
    ).toISOString()}`
  );

  try {
    const { question, electricianType, jobContext } = req.body || {};

    if (!question || !question.trim()) {
      console.warn("[Ask Traktr AI] Missing question text");
      // 200 + ok:false so mobile sees AI error, not network error
      return res.status(200).json({
        ok: false,
        error: "Missing question text",
      });
    }

    const trimmedQuestion = question.trim();
    console.log("[Ask Traktr AI] Question:", trimmedQuestion);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: buildAssistantSystemPrompt(
            electricianType,
            jobContext
          ),
        },
        {
          role: "user",
          content: trimmedQuestion,
        },
      ],
    });

    const answerText =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!answerText) {
      console.error("[Ask Traktr AI] Empty OpenAI response");
      return res.status(200).json({
        ok: false,
        error: "Empty AI response from OpenAI",
      });
    }

    console.log(
      `[Ask Traktr AI] OpenAI success in ${
        (Date.now() - startedAt) / 1000
      }s, length=${answerText.length}`
    );

    return res.json({
      ok: true,
      answerText,
    });
  } catch (err) {
    console.error("[Ask Traktr AI] error:", err);
    // Still return 200 so the app treats it as an AI error, not a network error
    return res.status(200).json({
      ok: false,
      error: err.message || "Ask Traktr AI internal error",
    });
  }
});

/* ------------------------------------------------------------------ */

const PORT = 4001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI gate listening on http://0.0.0.0:${PORT}`);
});
