// Vercel serverless endpoint for Gemini TTS. Keep GEMINI_API_KEY in Vercel Environment Variables.
export default async function handler(req, res) {
  const allowedOrigins = new Set([
    "https://subas-ghimire.vercel.app",
    "https://subas-ghimire.com.np",
    "https://www.subas-ghimire.com.np",
    "https://subahghimire.github.io"
  ]);
  const origin = req.headers.origin || "";
  if (allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "GEMINI_API_KEY is not configured in Vercel." });

  try {
    const { text, language = "auto", gender = "female", style = "news", pace = "normal" } = req.body || {};
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Please enter a script." });
    if (Buffer.byteLength(text, "utf8") > 4000) return res.status(413).json({ error: "Text is too long. Maximum 4,000 bytes." });

    const voices = { female: "Kore", male: "Orus" };
    const styles = {
      news: "Read this as a professional Nepali or international television news anchor. Clear diction, confident neutral broadcast delivery, natural pauses.",
      formal: "Read in a formal, polished broadcast narration style with clear pronunciation.",
      calm: "Read calmly and clearly, with a steady, reassuring delivery.",
      energetic: "Read like an energetic breaking-news headline, crisp and engaging but not shouting.",
      documentary: "Read in a warm, authoritative documentary narration style."
    };
    const paces = { slow: "Speak slowly and distinctly.", normal: "Use a natural, standard speaking pace.", fast: "Speak slightly faster while keeping every word clear." };
    const langNames = { "ne-NP": "Nepali", "en-US": "English (United States)", "en-IN": "English (India)", "hi-IN": "Hindi", "bn-BD": "Bangla", "ja-JP": "Japanese", "ko-KR": "Korean", "es-ES": "Spanish", "fr-FR": "French", "de-DE": "German", "ar-EG": "Arabic", "pt-BR": "Portuguese" };
    const langInstruction = language === "auto" || language === "other" ? "Detect and speak the language of the supplied text. Preserve the original language." : "Speak in " + (langNames[language] || language) + ".";
    const prompt = [styles[style] || styles.news, paces[pace] || paces.normal, langInstruction].join(" ");
    const model = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: text.trim(), speechMetadata: { style: prompt } }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[gender] || voices.female } } }
        }
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const message = data?.error?.message || "Gemini TTS request failed.";
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: message });
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find(part => part.inlineData?.data);
    if (!audioPart) return res.status(502).json({ error: "Gemini did not return audio. Check model access and API billing." });

    const audioBytes = Buffer.from(audioPart.inlineData.data, "base64");
    // Gemini 3.8 TTS returns a complete WAV file by default. Older/raw PCM
    // responses have no RIFF header and need a WAV wrapper.
    let wav = audioBytes;
    if (audioBytes.subarray(0, 4).toString("ascii") !== "RIFF") {
      const sampleRate = 24000, channels = 1, bitsPerSample = 16;
      wav = Buffer.alloc(44 + audioBytes.length);
      wav.write("RIFF", 0); wav.writeUInt32LE(36 + audioBytes.length, 4); wav.write("WAVE", 8);
      wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(channels, 22); wav.writeUInt32LE(sampleRate, 24);
      wav.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
      wav.writeUInt16LE(channels * bitsPerSample / 8, 32); wav.writeUInt16LE(bitsPerSample, 34);
      wav.write("data", 36); wav.writeUInt32LE(audioBytes.length, 40); audioBytes.copy(wav, 44);
    }
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", 'attachment; filename="subas-news-voice.wav"');
    res.setHeader("Content-Length", String(wav.length));
    return res.status(200).send(wav);
  } catch (error) {
    return res.status(500).json({ error: "Voice generation failed. " + (error?.message || "Please try again.") });
  }
}
