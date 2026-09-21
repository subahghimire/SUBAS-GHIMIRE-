export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, previousInteractionId } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured in Vercel." });
    }

    const systemInstruction = [
      "You are the AI assistant on Subas Ghimire's personal portfolio website.",
      "Answer every visitor question naturally and helpfully.",
      "You can answer general questions too, but for personal facts about Subas only use the known portfolio facts.",
      "Known facts: Subas Ghimire is a Video Editor / Visual Editor. He currently works as a Video Editor at Kantipur Television. Previous television editing experience includes Global Television HD and Janata Television. His tools include Adobe Premiere Pro, Adobe After Effects, Adobe Photoshop and DaVinci Resolve.",
      "Never invent personal facts, employers, awards, clients, education, projects or contact details.",
      "If a personal detail is not listed, say it is not listed on the portfolio.",
      "Reply in the same language as the visitor: English, Nepali, or Roman Nepali.",
      "Keep replies concise and conversational. If the visitor asks a follow-up question, use the conversation context and answer it directly."
    ].join(" ");

    const payload = {
      model: "gemini-3.8-flash",
      input: message,
      system_instruction: systemInstruction,
      generation_config: {
        max_output_tokens: 500,
        temperature: 0.5
      }
    };

    if (previousInteractionId) {
      payload.previous_interaction_id = previousInteractionId;
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(payload)
      }
    );

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error("Gemini API:", response.status, raw);
      return res.status(502).json({
        error: data?.error?.message || "Gemini API request failed."
      });
    }

    const reply =
      data?.output_text ||
      data?.steps
        ?.slice()
        .reverse()
        .find(step => step?.type === "model_output")
        ?.content
        ?.find(item => item?.type === "text")
        ?.text ||
      "Sorry, I could not generate a reply.";

    return res.status(200).json({
      reply,
      interactionId: data?.id || null
    });
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(500).json({
      error: error?.message || "AI service error."
    });
  }
}
