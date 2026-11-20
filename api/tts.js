export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = [
    "https://subahghimire.github.io",
    "https://subas-ghimire.vercel.app",
    "https://subas-ghimire.com.np",
    "https://www.subas-ghimire.com.np"
  ];
  const allowed = allowedOrigins.includes(origin);
  if (allowed) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY || process.env.SUBAS_ASSISTANCE;
  if (!apiKey) return res.status(503).json({ error: "GEMINI_API_KEY is not configured in Vercel." });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const language = typeof body?.language === "string" ? body.language : "ne";
    const style = typeof body?.style === "string" ? body.style : "bulletin";
    const languages = ["ne", "hi", "en"];
    const styles = ["bulletin", "breaking", "headline", "detailed", "documentary"];
    const voiceName = "Charon";
    if (!text) return res.status(400).json({ error: "कृपया पढाउनुपर्ने नेपाली वा अंग्रेजी text लेख्नुहोस्।" });
    if (text.length > 8000) return res.status(413).json({ error: "एक पटकमा ८,००० characters सम्मको text मात्र राख्नुहोस्।" });
    if (!languages.includes(language)) return res.status(400).json({ error: "नेपाली, हिन्दी वा English भाषा छान्नुहोस्।" });
    if (!styles.includes(style)) return res.status(400).json({ error: "समाचारको शैली छान्नुहोस्।" });

    const languageName = language === "ne" ? "Nepali" : language === "hi" ? "Hindi" : "English";
    const styleGuide = {
      bulletin: "Deliver as a clear, professional television news bulletin.",
      breaking: "Deliver as urgent breaking news, energetic and serious but not sensational.",
      headline: "Deliver crisp headline-style news with clear pauses between headlines.",
      detailed: "Deliver as a detailed news report, measured pace and clear emphasis on facts.",
      documentary: "Deliver as a documentary news narration, warm, steady and authoritative."
    }[style];
    const prompt = "Read the following text exactly as written in " + languageName + ". " + styleGuide + " Use natural pronunciation, clear diction and medium pace. Preserve the original wording. Do not translate, summarize, add an introduction, or speak any instructions.\\n\\n" + text;
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } }
            }
          }
        }),
        signal: AbortSignal.timeout(90000)
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || "Gemini TTS request failed.";
      return res.status(response.status).json({ error: message });
    }
    const part = (data?.candidates?.[0]?.content?.parts || []).find(p => p?.inlineData?.data || p?.inline_data?.data);
    const encoded = part?.inlineData?.data || part?.inline_data?.data;
    if (!encoded) return res.status(502).json({ error: "AI ले audio फर्काएन। केहीबेरपछि फेरि प्रयास गर्नुहोस्।" });

    const pcm = Buffer.from(encoded, "base64");
    const sampleRate = 24000;
    const channels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const wav = Buffer.alloc(44 + pcm.length);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(36 + pcm.length, 4);
    wav.write("WAVE", 8);
    wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(channels, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(byteRate, 28);
    wav.writeUInt16LE(channels * bitsPerSample / 8, 32);
    wav.writeUInt16LE(bitsPerSample, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(pcm.length, 40);
    pcm.copy(wav, 44);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(wav.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", 'inline; filename="subas-ai-voice.wav"');
    return res.status(200).send(wav);
  } catch (error) {
    console.error("Gemini TTS error:", error);
    return res.status(500).json({ error: error?.name === "TimeoutError" ? "Audio बनाउन समय लाग्यो। छोटो text राखेर प्रयास गर्नुहोस्।" : "Audio बनाउन सकिएन। API key र quota जाँच गर्नुहोस्।" });
  }
}
