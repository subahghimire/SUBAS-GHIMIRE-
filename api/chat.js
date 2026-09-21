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
      "You are the AI assistant for Subas Ghimire's personal portfolio website.",
      "Answer naturally and helpfully about Subas, his video-editing career, skills, software, portfolio, experience and contact information.",
      "Known portfolio facts: Subas Ghimire is a Video Editor / Visual Editor. He currently works as a Video Editor at Kantipur Television. Previous television editing experience includes Global Television HD and Janata Television. His tools include Adobe Premiere Pro, Adobe After Effects, Adobe Photoshop and DaVinci Resolve.",
      "Do not invent employers, awards, projects, education, clients, contact details or other personal facts.",
      "If the portfolio does not provide an answer, say that the information is not listed on the portfolio.",
      "Keep normal answers concise unless the visitor asks for detail.",
      "Answer in English, Nepali, or Roman Nepali according to the visitor's language."
    ].join(" ");

    const payload = {
      model: "gemini-2.5-flash",
      input: message,
      system_instruction: systemInstruction,
      generation_config: {
        max_output_tokens: 500,
        temperature: 0.4
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
        error: data?.error?.message || `Gemini API returned HTTP ${response.status}.`
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
      "I couldn't generate a response.";

    return res.status(200).json({
      reply,
      interactionId: data?.id || null
    });
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(500).json({
      error: error?.message || "AI service error"
    });
  }
}
