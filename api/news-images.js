export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = ["https://subahghimire.github.io", "https://subas-ghimire.vercel.app", "https://subas-ghimire.com.np", "https://www.subas-ghimire.com.np"];
  if (allowedOrigins.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.GEMINI_API_KEY || process.env.SUBAS_ASSISTANCE;
  if (!apiKey) return res.status(503).json({ error: "News photo search API key is not configured." });
  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "समाचारको script आवश्यक छ।" });
    if (text.length > 8000) return res.status(413).json({ error: "८,००० characters सम्मको script मात्र पठाउनुहोस्।" });

    const prompt = `Analyze this news narration and divide it into 5 to 7 chronological visual scenes. Return ONLY valid JSON with this exact shape: {"scenes":[{"caption":"short scene meaning in the narration language","searchQuery":"specific English Wikimedia Commons photo search phrase"}]}. Search phrases must name concrete people, places, events, objects or locations from the narration, not generic concepts. Keep scenes in narration order. Do not invent facts or people. If the narration mentions a named person or place, use the exact name. Make the searches suitable for editorial documentary photographs. Narration:\\n${text.slice(0, 7800)}`;
    const ai = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }),
      signal: AbortSignal.timeout(35000)
    });
    const aiData = await ai.json().catch(() => ({}));
    if (!ai.ok) return res.status(ai.status).json({ error: aiData?.error?.message || "समाचारको दृश्य छुट्याउन सकिएन।" });
    let raw = aiData?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error("AI ले दृश्य सूची सही रूपमा तयार गरेन।"); }
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.slice(0, 7) : [];
    if (!scenes.length) throw new Error("समाचारका लागि दृश्य भेटिएन।");

    const results = await Promise.all(scenes.map(async (scene) => {
      const query = String(scene.searchQuery || "").trim().slice(0, 180);
      if (!query) return null;
      const params = new URLSearchParams({
        action: "query", generator: "search", gsrsearch: "filetype:bitmap " + query,
        gsrnamespace: "6", gsrlimit: "6", prop: "imageinfo", iiprop: "url|extmetadata",
        iiurlwidth: "1800", format: "json", formatversion: "2"
      });
      const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString(), {
        headers: { "User-Agent": "NewsVoiceStudio/1.0 (editorial photo search)" },
        signal: AbortSignal.timeout(18000)
      });
      if (!response.ok) return null;
      const data = await response.json();
      const pages = data?.query?.pages || [];
      const page = pages.find(p => p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url);
      const info = page?.imageinfo?.[0];
      if (!info) return null;
      const meta = info.extmetadata || {};
      const strip = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
      return {
        caption: String(scene.caption || query).slice(0, 120),
        searchQuery: query,
        imageUrl: info.thumburl || info.url,
        title: strip(page.title || ""),
        sourceUrl: strip(meta.Descriptionshorturl?.value || meta.LicenseUrl?.value || ""),
        artist: strip(meta.Artist?.value || ""),
        license: strip(meta.LicenseShortName?.value || "Wikimedia Commons")
      };
    }));
    const found = results.filter(Boolean);
    if (!found.length) return res.status(404).json({ error: "यस समाचारसँग मिल्ने Wikimedia Commons फोटो भेटिएन। केहीबेरपछि फेरि प्रयास गर्नुहोस्।" });
    return res.status(200).json({ scenes: found });
  } catch (error) {
    console.error("News photo search error:", error);
    return res.status(error?.name === "TimeoutError" ? 504 : 500).json({ error: error?.message || "समाचारका फोटो खोज्न सकिएन।" });
  }
}