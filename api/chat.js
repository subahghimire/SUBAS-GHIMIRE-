const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const KEY_RETRY_STATUS = new Set([401, 403, 429]);
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

async function geminiRequest(url, options, timeoutMs = 10000) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!RETRYABLE_STATUS.has(response.status) || attempt === 1) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
    }

    await sleep(400);
  }

  throw lastError || new Error("Gemini request failed");
}

// Move to the next key only for authentication errors or exhausted quota.
// Important: call geminiRequest here; never call this function recursively.
async function geminiRequestWithKeys(keys, url, options) {
  let response;

  for (const key of keys) {
    const headers = {
      ...(options.headers || {}),
      "x-goog-api-key": key
    };

    response = await geminiRequest(url, { ...options, headers });

    if (!KEY_RETRY_STATUS.has(response.status)) return response;
  }

  return response;
}

function getJsonResponse(response) {
  return response.json().catch(() => ({}));
}

function getGenerateContentText(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(part => typeof part?.text === "string" ? part.text : "")
    .join("")
    .trim();
}

function getInteractionText(data) {
  return (data?.steps || [])
    .filter(step => step?.type === "model_output")
    .flatMap(step => step?.content || [])
    .map(part => typeof part?.text === "string" ? part.text : "")
    .join("")
    .trim();
}

export default async function handler(req, res) {
  const allowedOrigins = new Set([
    "https://subahghimire.github.io",
    "https://subas-ghimire.vercel.app",
    "https://subas-ghimire.com.np",
    "https://www.subas-ghimire.com.np"
  ]);
  const origin = req.headers.origin || "";

  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ reply: "यो वेबसाइटबाट अनुरोध गर्न अनुमति छैन।" });
  }

  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed." });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ reply: "Invalid request body." });
      }
    }

    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const image = body?.image &&
      typeof body.image.data === "string" &&
      typeof body.image.mimeType === "string"
      ? body.image
      : null;

    if (!message && !image) {
      return res.status(400).json({ reply: "कृपया प्रश्न लेख्नुहोस् वा फोटो छान्नुहोस्।" });
    }

    if (message.length > 4000) {
      return res.status(400).json({ reply: "Please keep your question under 4000 characters." });
    }

    // 6 MB binary image is approximately 8 MB after Base64 encoding.
    if (image && (
      !/^image\/(jpeg|png|webp|gif)$/.test(image.mimeType) ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data) ||
      image.data.length > 8 * 1024 * 1024
    )) {
      return res.status(400).json({
        reply: "फोटो JPEG, PNG, WEBP वा GIF हुनुपर्छ र ६ MB भन्दा सानो हुनुपर्छ।"
      });
    }

    const apiKeys = [...new Set([
      process.env.GEMINI_API_KEY,
      process.env.SUBAS_ASSISTANCE,
      process.env.GEMINI_API_KEY_BACKUP
    ].map(value => typeof value === "string" ? value.trim() : "").filter(Boolean))];

    if (!apiKeys.length) {
      console.error("Gemini API keys are not configured");
      return res.status(503).json({
        reply: "AI जोडिएको छैन। Vercel Environment Variables मा GEMINI_API_KEY राख्नुहोस्।"
      });
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

    const startedAt = Date.now();

    if (image) {
      let sawRateLimit = false;
      let sawAuthError = false;
      let sawTimeout = false;

      for (const model of MODELS) {
        if (Date.now() - startedAt > 48000) break;

        let response;
        try {
          response = await geminiRequestWithKeys(
            apiKeys,
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: systemInstruction }]
                },
                contents: [{
                  role: "user",
                  parts: [
                    { text: message || "यो फोटो हेरेर यसको बारेमा बताउनुहोस्।" },
                    {
                      inlineData: {
                        mimeType: image.mimeType,
                        data: image.data
                      }
                    }
                  ]
                }],
                generationConfig: { maxOutputTokens: 1024 }
              })
            }
          );
        } catch (error) {
          if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            sawTimeout = true;
          }
          console.error("Gemini image request failed:", model, error?.name || "network");
          continue;
        }

        const data = await getJsonResponse(response);

        if (!response.ok) {
          console.error("Gemini image API error:", model, response.status, data?.error?.message || "unknown error");
          if (response.status === 429) sawRateLimit = true;
          if (response.status === 401 || response.status === 403) sawAuthError = true;
          if ([400, 401, 403, 404, 429, 500, 502, 503, 504].includes(response.status)) continue;
          break;
        }

        const reply = getGenerateContentText(data);
        if (reply) return res.status(200).json({ reply });
        console.error("Gemini image response contained no text:", model);
      }

      if (sawAuthError && !sawRateLimit) {
        return res.status(503).json({ reply: "Gemini API Key मा permission समस्या छ। Vercel Environment Variables जाँच गर्नुहोस्।" });
      }
      if (sawRateLimit) {
        return res.status(503).json({ reply: "फोटो विश्लेषणका लागि अहिले Gemini को request limit पुगेको छ। केही समयपछि फेरि प्रयास गर्नुहोस्।" });
      }
      if (sawTimeout) {
        return res.status(504).json({ reply: "फोटो विश्लेषणमा ढिलाइ भयो। कृपया सानो फोटो राखेर फेरि प्रयास गर्नुहोस्।" });
      }
      return res.status(502).json({ reply: "फोटो विश्लेषण अहिले उपलब्ध भएन। कृपया अर्को फोटो प्रयास गर्नुहोस्।" });
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/interactions";
    let sawRateLimit = false;
    let sawAuthError = false;
    let sawTimeout = false;

    for (const model of MODELS) {
      if (Date.now() - startedAt > 48000) break;

      let response;
      try {
        response = await geminiRequestWithKeys(apiKeys, url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            input: message,
            system_instruction: systemInstruction,
            generation_config: { thinking_level: "low" },
            store: false
          })
        });
      } catch (error) {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
          sawTimeout = true;
        }
        console.error("Gemini request failed:", model, error?.name || "network");
        continue;
      }

      const data = await getJsonResponse(response);

      if (!response.ok) {
        console.error("Gemini Interactions API error:", model, response.status, data?.error?.message || "unknown error");
        if (response.status === 429) sawRateLimit = true;
        if (response.status === 401 || response.status === 403) sawAuthError = true;
        if ([400, 401, 403, 404, 429, 500, 502, 503, 504].includes(response.status)) continue;
        break;
      }

      const reply = getInteractionText(data);
      if (reply) return res.status(200).json({ reply });
      console.error("Gemini returned no text:", model);
    }

    if (sawAuthError && !sawRateLimit) {
      return res.status(503).json({ reply: "Gemini API Key मा authentication वा permission समस्या छ। Vercel Environment Variables जाँच गर्नुहोस्।" });
    }
    if (sawRateLimit) {
      return res.status(503).json({ reply: "Gemini API को request limit पुगेको छ वा सेवा व्यस्त छ। केही समयपछि फेरि प्रयास गर्नुहोस्।" });
    }
    if (sawTimeout) {
      return res.status(504).json({ reply: "AI जवाफ आउन ढिलो भयो। वैकल्पिक मोडेलहरू पनि प्रयास गरियो। कृपया फेरि प्रयास गर्नुहोस्।" });
    }

    return res.status(502).json({ reply: "AI सेवा अहिले व्यस्त छ। वैकल्पिक मोडेलहरू पनि प्रयास गरियो, तर जवाफ आएन। केही समयपछि फेरि प्रयास गर्नुहोस्।" });
  } catch (error) {
    console.error("Chat handler error:", error?.name || "Error", error?.message || "unknown error");
    return res.status(500).json({ reply: "AI सेवा अहिले उपलब्ध भएन। कृपया फेरि प्रयास गर्नुहोस्।" });
  }
}
