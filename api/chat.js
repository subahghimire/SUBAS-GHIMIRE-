export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowed = origin === "https://subahghimire.github.io" || origin === "https://subas-ghimire.vercel.app" || origin === "https://subas-ghimire.com.np" || origin === "https://www.subas-ghimire.com.np";
  res.setHeader("Access-Control-Allow-Origin", allowed ? origin : "https://subas-ghimire.vercel.app");
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
    const image = body?.image && typeof body.image.data === "string" && typeof body.image.mimeType === "string" ? body.image : null;
    if (!message && !image) return res.status(400).json({ reply: "कृपया प्रश्न लेख्नुहोस् वा फोटो छान्नुहोस्।" });
    if (image && (!/^image\/(jpeg|png|webp|gif)$/.test(image.mimeType) || !/^[A-Za-z0-9+/]+=*$/.test(image.data) || image.data.length > 8 * 1024 * 1024)) return res.status(400).json({ reply: "फोटो JPEG, PNG, WEBP वा GIF हुनुपर्छ र ६ MB भन्दा सानो हुनुपर्छ।" });
    if (message.length > 4000) return res.status(400).json({ reply: "Please keep your question under 4000 characters." });

    const apiKey = process.env.GEMINI_API_KEY || process.env.SUBAS_ASSISTANCE;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing");
      return res.status(200).json({ reply: "AI जोडिएको छैन। Vercel मा GEMINI_API_KEY नामको Environment Variable मा Google AI Studio को API Key राख्नुहोस्।" });
    }

    const systemInstruction = [
      "You are SG Assistant, a helpful general-purpose AI assistant on Subas Ghimire's personal portfolio website.",
      "Answer questions on ANY topic the visitor asks about, not only video editing or portfolio topics. Topics may include general knowledge, education, science, technology, business, writing, translation, coding, calculations, news context, travel, entertainment, everyday problems, and casual conversation.",
      "Do not reject or redirect a question merely because it is unrelated to Subas, video editing, or Adobe software. Give the best useful answer you can within your knowledge and applicable safety rules.",
      "Answer the actual question directly and completely. If the request is unclear, ask one short clarifying question. For multi-part questions, address every part.",
      "For instructions or how-to requests, provide clear step-by-step guidance appropriate to the visitor's skill level. For calculations, calculate carefully and show the result. For writing requests, produce the requested draft rather than only giving advice.",
      "Do not pretend to browse the internet, access live data, open files, or perform actions that you have not actually performed. For current or uncertain facts, clearly say when information may need verification; never invent sources, links, statistics, or recent events.",
      "For personal facts about Subas, use only these facts: Subas Ghimire is a Video Editor / Visual Editor; he currently works as a Video Editor at Kantipur Television; previous television editing experience includes Global Television HD and Janata Television; tools include Adobe Premiere Pro, Adobe After Effects, Adobe Photoshop and DaVinci Resolve.",
      "Never invent personal facts, employers, awards, clients, education, projects or contact details about Subas. If a personal detail is not listed, say that it is not listed on the portfolio.",
      "Reply in the same language as the visitor, including Nepali, Roman Nepali, or English. If the visitor mixes languages, respond naturally in the same style. For a bare greeting or a short unclear opener such as hi, hello, or hey, greet the visitor briefly in Nepali first, then invite their question.",
      "Use simple, natural language. Be concise for simple questions and provide detail when the question requires it. Avoid generic filler and do not repeatedly say you are only a video-editing assistant."
    ].join(" ");

    if (image) {
      // Try lightweight models first so one busy model or exhausted
      // per-model quota does not block photo questions.
      const imageModels = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
      let imageRateLimited = false;
      let imageTimedOut = false;
      for (const model of imageModels) {
        let response;
        try {
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            signal: AbortSignal.timeout(12000),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ role: "user", parts: [
                ...(message ? [{ text: message }] : [{ text: "यो फोटो हेरेर यसको बारेमा बताउनुहोस्।" }]),
                { inline_data: { mime_type: image.mimeType, data: image.data } }
              ] }],
              generationConfig: { maxOutputTokens: 1024 }
            })
          });
        } catch (error) {
          if (error?.name === "TimeoutError" || error?.name === "AbortError") imageTimedOut = true;
          console.error("Gemini image request failed:", model, error?.name || "network");
          continue;
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error("Gemini image API error:", model, response.status, JSON.stringify(data));
          if (response.status === 429) imageRateLimited = true;
          if ([400, 404, 429, 500, 502, 503, 504].includes(response.status)) continue;
          break;
        }

        const reply = (data?.candidates?.[0]?.content?.parts || []).map(part => part?.text || "").join("").trim();
        if (reply) return res.status(200).json({ reply });
      }

      if (imageRateLimited) return res.status(200).json({ reply: "फोटो विश्लेषणका लागि अहिले Gemini को निःशुल्क सीमा पुगेको छ। केही समयपछि फेरि प्रयास गर्नुहोस्।" });
      if (imageTimedOut) return res.status(200).json({ reply: "फोटो विश्लेषणमा ढिलाइ भयो। कृपया सानो फोटो राखेर फेरि प्रयास गर्नुहोस्।" });
      return res.status(200).json({ reply: "फोटो विश्लेषण अहिले उपलब्ध भएन। कृपया अर्को फोटो प्रयास गर्नुहोस्।" });
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/interactions";
    // Start with the lightweight model for faster replies, then fall back to
    // progressively stronger models if a model is busy or quota-limited.
    const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
    let sawRateLimit = false;
    let lastFailure = "";

    for (const model of models) {
      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            model,
            input: message,
            system_instruction: systemInstruction,
            generation_config: { thinking_level: "low" },
            store: false
          })
        });
      } catch (error) {
        lastFailure = error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "network";
        console.error("Gemini request failed:", model, lastFailure);
        continue;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastFailure = data?.error?.message || data?.message || "request failed";
        console.error("Gemini Interactions API error:", model, response.status, JSON.stringify(data));

        if (response.status === 401 || response.status === 403) {
          return res.status(200).json({ reply: "Gemini API key मा authentication वा permission समस्या छ। Vercel को GEMINI_API_KEY जाँच गर्नुहोस्।" });
        }
        if (response.status === 429) sawRateLimit = true;
        if ([400, 404, 429, 500, 502, 503, 504].includes(response.status)) continue;
        break;
      }

      const reply = (data?.steps || [])
        .filter(step => step?.type === "model_output")
        .flatMap(step => step?.content || [])
        .map(part => part?.text || "")
        .join("")
        .trim();

      if (reply) return res.status(200).json({ reply });
      lastFailure = "empty";
      console.error("Gemini returned no text:", model, JSON.stringify(data));
    }

    if (lastFailure === "timeout") {
      return res.status(200).json({ reply: "AI जवाफ आउन ढिलो भयो। छिटो मोडेल र वैकल्पिक मोडेलहरू पनि प्रयास गरियो। कृपया फेरि प्रयास गर्नुहोस्।" });
    }
    if (sawRateLimit) {
      return res.status(200).json({ reply: "Gemini API को request limit पुगेको छ वा सेवा व्यस्त छ। केही समयपछि फेरि प्रयास गर्नुहोस्।" });
    }
    return res.status(200).json({ reply: "AI सेवा अहिले व्यस्त छ। वैकल्पिक मोडेलहरू पनि प्रयास गरियो, तर जवाफ आएन। कृपया केही समयपछि फेरि प्रयास गर्नुहोस्।" });
  } catch (error) {
    console.error("Chat handler error:", error);
    return res.status(200).json({ reply: "AI सेवा अहिले उपलब्ध भएन। कृपया फेरि प्रयास गर्नुहोस्।" });
  }
}