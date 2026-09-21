export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://subahghimire.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, previousInteractionId } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "AI service is not configured." });
    }

    const systemInstruction = [
      "You are the AI assistant on Subas Ghimire's personal portfolio website.",
      "Answer any normal text question naturally and helpfully.",
      "You can answer general questions, simple calculations, explanations, writing help, and casual questions.",
      "For personal facts about Subas, only use these known facts: Subas Ghimire is a Video Editor / Visual Editor; he currently works as a Video Editor at Kantipur Television; previous television editing experience includes Global Television HD and Janata Television; tools include Adobe Premiere Pro, Adobe After Effects, Adobe Photoshop and DaVinci Resolve.",
      "Never invent personal facts, employers, awards, clients, education, projects or contact details.",
      "If a personal detail is not listed, say it is not listed on the portfolio.",
      "Reply in the same language as the visitor: English, Nepali, or Roman Nepali.",
      "Keep replies concise and conversational."
    ].join(" ");

    const makeRequest = async (includePrevious) => {
      const payload = {
        model: "gemini-3.8-flash",
        input: message,
        system_instruction: systemInstruction
      };

      if (includePrevious && previousInteractionId) {
        payload.previous_interaction_id = previousInteractionId;
      }

      return fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(payload)
      });
    };

    let response = await makeRequest(true);

    // If an old/expired conversation ID causes an error, retry as a fresh chat.
    if (!response.ok && previousInteractionId) {
      response = await makeRequest(false);
    }

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
        error: "AI could not answer right now. Please try again."
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
      "I’m ready. Please ask me anything.";

    return res.status(200).json({
      reply,
      interactionId: data?.id || null
    });
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(200).json({
      reply: "I’m ready to help. Please try your question again.",
      interactionId: null
    });
  }
}
