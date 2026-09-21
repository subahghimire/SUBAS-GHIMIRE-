export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://subahghimire.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        reply: "AI assistant is being configured. Please try again shortly.",
        interactionId: null
      });
    }

    const instructions = [
      "You are the AI assistant on Subas Ghimire's personal portfolio website.",
      "Answer normal questions naturally and helpfully. You can answer general questions, simple calculations, explanations, writing help, and casual questions.",
      "For personal facts about Subas, only use these known facts: Subas Ghimire is a Video Editor / Visual Editor; he currently works as a Video Editor at Kantipur Television; previous television editing experience includes Global Television HD and Janata Television; tools include Adobe Premiere Pro, Adobe After Effects, Adobe Photoshop and DaVinci Resolve.",
      "Never invent personal facts, employers, awards, clients, education, projects or contact details.",
      "If a personal detail is not listed, say it is not listed on the portfolio.",
      "Reply in the same language as the visitor: English, Nepali, or Roman Nepali.",
      "Keep replies concise and conversational."
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions,
        input: message,
        max_output_tokens: 500
      })
    });

    const raw = await response.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error("OpenAI API:", response.status, raw);
      return res.status(200).json({
        reply: "I’m ready to help. Please try your question again.",
        interactionId: null
      });
    }

    const reply =
      data?.output_text ||
      data?.output
        ?.flatMap(item => item?.content || [])
        ?.find(item => item?.type === "output_text")
        ?.text ||
      "I’m ready to help. Please ask me anything.";

    return res.status(200).json({
      reply,
      interactionId: data?.id || null
    });
  } catch (error) {
    console.error("OpenAI API error:", error);
    return res.status(200).json({
      reply: "I’m ready to help. Please try your question again.",
      interactionId: null
    });
  }
}
