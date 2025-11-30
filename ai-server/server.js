// server.js
// Simple AI gate for Traktr Team Chat

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

// Helper: build prompt for the electrician AI
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

const PORT = 4001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI gate listening on http://0.0.0.0:${PORT}`);
});

