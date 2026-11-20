export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = [
    "https://subahghimire.github.io",
    "https://subas-ghimire.vercel.app",
    "https://subas-ghimire.com.np",
    "https://www.subas-ghimire.com.np"
  ];
  let allowedOrigin = allowedOrigins.includes(origin);
  try {
    const host = new URL(origin).hostname;
    if (host.endsWith(".vercel.app") && host.startsWith("subas-ghimire-")) allowedOrigin = true;
  } catch {}
  if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKeys = [...new Set([
    process.env.GEMINI_API_KEY,
    process.env.SUBAS_ASSISTANCE
  ].map(value => typeof value === "string" ? value.trim() : "").filter(Boolean))];
  if (!apiKeys.length) return res.status(503).json({ error: "Vercel मा GEMINI_API_KEY वा SUBAS_ASSISTANCE configure गरिएको छैन।" });

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
    const prompt = "Read the following text exactly as written in " + languageName + ". " + styleGuide + " Use natural pronunciation, clear diction and medium pace. Preserve the original wording. Do not translate, summarize, add an introduction, or speak any instructions.\n\n" + text;

    let data = null;
    let lastStatus = 502;
    let lastMessage = "Gemini TTS बाट audio प्राप्त भएन।";
    for (let index = 0; index < apiKeys.length; index++) {
      let response;
      try {
        response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKeys[index] },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
              }
            }),
            signal: AbortSignal.timeout(42000)
          }
        );
      } catch (error) {
        lastStatus = error?.name === "TimeoutError" ? 504 : 502;
        lastMessage = error?.name === "TimeoutError" ? "Audio बनाउन धेरै समय लाग्यो। छोटो script राखेर फेरि प्रयास गर्नुहोस्।" : "Gemini सेवा सँग जडान हुन सकेन।";
        continue;
      }
      data = await response.json().catch(() => ({}));
      if (response.ok) break;
      lastStatus = response.status;
      lastMessage = data?.error?.message || "Gemini TTS request असफल भयो।";
      // Try the backup configured key for invalid-key, access, quota and transient service errors.
      if (![400, 413].includes(response.status) && index < apiKeys.length - 1) continue;
      return res.status(lastStatus).json({ error: lastMessage });
    }

    if (!data || !data.candidates?.length) {
      return res.status(lastStatus).json({ error: lastMessage });
    }
    const part = (data?.candidates?.[0]?.content?.parts || []).find(p => p?.inlineData?.data || p?.inline_data?.data);
    const encoded = part?.inlineData?.data || part?.inline_data?.data;
    if (!encoded) {
      const blockReason = data?.promptFeedback?.blockReason;
      return res.status(502).json({ error: blockReason ? "Gemini ले यो text audio मा बदल्न अस्वीकार गर्‍यो: " + blockReason : "AI ले audio फर्काएन। छोटो script राखेर फेरि प्रयास गर्नुहोस्।" });
    }

    const pcm = Buffer.from(encoded, "base64");
    if (!pcm.length) return res.status(502).json({ error: "AI ले खाली audio फर्कायो।" });
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
    res.setHeader("Content-Disposition", 'attachment; filename="news-ai-voice.wav"');
    return res.status(200).send(wav);
  } catch (error) {
    console.error("Gemini TTS error:", error);
    return res.status(500).json({ error: error?.name === "TimeoutError" ? "Audio बनाउन समय लाग्यो। छोटो text राखेर प्रयास गर्नुहोस्।" : "Audio बनाउन सकिएन। API key, model access र quota जाँच गर्नुहोस्।" });
  }
}
