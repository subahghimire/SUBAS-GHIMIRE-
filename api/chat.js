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
      return res.status(200).json({ reply: "AI जोडिएको छैन। Vercel मा GEMINI_API_KEY configuration जाँच गर्नुपर्छ।" });
    }

    const systemInstruction = [
      "You are SG Assistant, a helpful general-purpose AI assistant on Subas Ghimire's personal portfolio website.",
      "IMPORTANT: Answer questions on ANY topic the visitor asks about, not only video editing or portfolio topics. Topics may include general knowledge, education, science, technology, business, writing, translation, coding, calculations, news context, travel, entertainment, everyday problems, and casual conversation.",
      "Do not reject or redirect a question merely because it is unrelated to Subas, video editing, or Adobe software. Give the best useful answer you can within your knowledge and applicable safety rules.",
      "Answer the actual question directly and completely. If the request is unclear, ask one short clarifying question. For multi-part questions, address every part.",
      "For instructions or how-to requests, provide clear step-by-step guidance appropriate to the visitor's skill level. For calculations, calculate carefully and show the result. For writing requests, produce the requested draft rather than only giving advice.",
      "Do not pretend to browse the internet, access live data, open files, or perform actions that you have not actually performed. For current or uncertain facts, clearly say when information may need verification; never invent sources, links, statistics, or recent events.",
      "For personal facts about Subas, use only these facts: Subas Ghimire is a Video Editor / Visual Editor; he currently works as a Video Editor at Kantipur Television; previous television editing experience includes Global Television HD and Janata Television; tools include Adobe Premiere Pro, Adobe After Effects, Adobe Photoshop and DaVinci Resolve.",
      "Never invent personal facts, employers, awards, clients, education, projects or contact details about Subas. If a personal detail is not listed, say that it is not listed on the portfolio.",
      "Reply in the same language as the visitor, including Nepali, Roman Nepali, or English. If the visitor mixes languages, respond naturally in the same style.",
      "Use simple, natural language. Be concise for simple questions and provide detail when the question requires it. Avoid generic filler and do not repeatedly say you are only a video-editing assistant."
    ].join(" ");

    const url = "https://generativelanguage.googleapis.com/v1beta/interactions";
    const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
    let lastStatus = 0;
    let lastApiMessage = "";

    for (let i = 0; i < models.length; i++) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, i === 1 ? 900 : 500));
      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(13000),
          body: JSON.stringify({
            model: models[i],
            input: message,
            system_instruction: systemInstruction,
            generation_config: { thinking_level: "low" },
            store: false
          })
        });
      } catch (error) {
        lastApiMessage = error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "network";
        console.error("Gemini request failed:", models[i], lastApiMessage);
        continue;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastStatus = response.status;
        lastApiMessage = data?.error?.message || data?.message || "";
        console.error("Gemini Interactions API error:", models[i], response.status, JSON.stringify(data));

        if (response.status === 401 || response.status === 403) {
          return res.status(200).json({ reply: "Gemini API key मा authentication वा permission समस्या छ। Vercel को GEMINI_API_KEY जाँच गर्नुपर्छ।" });
        }
        // A quota limit on one model does not necessarily mean every model is
        // exhausted. Continue to the distinct fallback model before failing.
        if (response.status === 429 || response.status === 503 || response.status === 500 || response.status === 502 || response.status === 504) {
          continue;
        }
        break;
      }

      const reply = (data?.steps || [])
        .filter(step => step?.type === "model_output")
        .flatMap(step => step?.content || [])
        .map(part => part?.text || "")
        .join("")
        .trim();

      if (reply) return res.status(200).json({ reply });
      console.error("Gemini returned no text:", JSON.stringify(data));
      lastApiMessage = "empty";
    }

    if (lastStatus === 429) {
      return res.status(200).json({ reply: "दुवै AI मोडेलको हालको request limit पुगेको छ। केही समयपछि फेरि प्रयास गर्नुहोस्।" });
    }
    return res.status(200).json({
      reply: lastApiMessage === "timeout"
        ? "AI जवाफ आउन ढिलो भयो। कृपया फेरि प्रयास गर्नुहोस्।"
        : "AI सेवा अहिले व्यस्त छ। अर्को मोडेलबाट पनि प्रयास गरियो, तर जवाफ आएन। कृपया केही समयपछि फेरि प्रयास गर्नुहोस्।"
    });
  } catch (error) {
    console.error("Chat handler error:", error);
    return res.status(200).json({ reply: "AI सेवा अहिले उपलब्ध भएन। कृपया फेरि प्रयास गर्नुहोस्।" });
  }
}