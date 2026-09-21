export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowed = origin === "https://subahghimire.github.io" || origin === "https://subas-ghimire.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", allowed ? origin : "https://subahghimire.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed." });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return res.status(400).json({ reply: "Please type a question first." });
    if (message.length > 4000) return res.status(400).json({ reply: "Please keep your question under 4000 characters." });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing");
      return res.status(200).json({ reply: "AI is not connected yet. Please check the server configuration." });
    }

    const systemInstruction = [
      "You are the AI assistant on Subas Ghimire's personal portfolio website.",
      "Answer the visitor's question directly. Do not just repeat the question.",
      "You can answer general questions, explain concepts, help with writing, simple calculations, and casual questions.",
      "For personal facts about Subas, use only these facts: Subas Ghimire is a Video Editor / Visual Editor; he currently works as a Video Editor at Kantipur Television; previous television editing experience includes Global Television HD and Janata Television; tools include Adobe Premiere Pro, Adobe After Effects, Adobe Photoshop and DaVinci Resolve.",
      "Never invent personal facts, employers, awards, clients, education, projects or contact details.",
      "If a personal detail is not listed, say that it is not listed on the portfolio.",
      "Reply in the same language as the visitor: English, Nepali, or Roman Nepali.",
      "Keep the answer concise, useful and conversational."
    ].join(" ");

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(apiKey);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 700
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, JSON.stringify(data));
      return res.status(200).json({
        reply: "AI service ma problem aayo. Please try again in a moment."
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts
      ?.map(part => part?.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Gemini returned no text:", JSON.stringify(data));
      return res.status(200).json({
        reply: "I couldn't generate an answer right now. Please try asking in a different way."
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Chat handler error:", error);
    return res.status(200).json({
      reply: "AI service temporarily unavailable. Please try again."
    });
  }
}