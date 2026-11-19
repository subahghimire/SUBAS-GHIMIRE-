// Gemini Omni 1.2 Flash video generation via the Gemini Interactions API.
// Keep GEMINI_API_KEY on the server. Preview Veo 3.1 endpoints are retired.
export default async function handler(req, res) {
  const allowedOrigins = new Set([
    "https://subahghimire.github.io",
    "https://subas-ghimire.vercel.app",
    "https://subas-ghimire.com.np",
    "https://www.subas-ghimire.com.np"
  ]);
  const origin = req.headers.origin || "";
  if (allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "GEMINI_API_KEY is not configured in Vercel." });

  const base = "https://generativelanguage.googleapis.com/v1beta";
  try {
    if (req.method === "POST") {
      const { prompt, aspectRatio = "16:9", duration = "15s", resolution = "720p" } = req.body || {};
      if (typeof prompt !== "string" || !prompt.trim()) return res.status(400).json({ error: "Video prompt is required." });
      if (!/^([3-9]|1[0-5])s$/.test(duration)) return res.status(400).json({ error: "Clip duration must be between 3 and 15 seconds." });
      const response = await fetch(base + "/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          model: process.env.GEMINI_VIDEO_MODEL || "gemini-omni-1.2-flash",
          background: true,
          store: true,
          input: [{ type: "text", text: prompt.trim().slice(0, 12000) }],
          response_format: {
            type: "video",
            duration,
            resolution: ["360p", "720p", "1080p", "4k"].includes(resolution) ? resolution : "720p",
            aspect_ratio: aspectRatio === "9:16" ? "9:16" : "16:9"
          },
          generation_config: { video_config: { task: "text_to_video" } }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error?.message || data?.message || "Gemini Omni video request failed.";
        const retired = /not found|not supported|unknown model/i.test(message);
        return res.status(response.status).json({
          error: retired ? message + " Check that Gemini Omni 1.2 Flash is enabled for this API project." : message
        });
      }
      if (!data.id) return res.status(502).json({ error: "Gemini did not return a video job ID." });
      return res.status(202).json({ operation: data.id, status: data.status || "in_progress" });
    }

    if (req.method === "GET") {
      const operation = req.query?.operation;
      const download = req.query?.download === "1";
      if (typeof operation !== "string" || !/^[A-Za-z0-9_-]{8,160}$/.test(operation)) {
        return res.status(400).json({ error: "Invalid video job ID." });
      }
      const response = await fetch(base + "/interactions/" + encodeURIComponent(operation), {
        headers: { "x-goog-api-key": apiKey }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || data?.message || "Could not check video job." });
      if (data.status === "failed" || data.error) {
        return res.status(502).json({ done: true, error: data?.error?.message || data?.error || "Video generation failed." });
      }
      const video = (data.steps || [])
        .filter(step => step.type === "model_output")
        .flatMap(step => step.content || [])
        .find(item => item.type === "video" && (item.data || item.uri));
      if (!video) {
        const done = ["completed", "succeeded"].includes(data.status);
        return res.status(200).json({ done, ready: false, status: data.status || "in_progress", error: done ? "Video completed but no inline MP4 data was returned. Confirm inline video delivery is enabled for this model." : undefined });
      }
      if (!download) return res.status(200).json({ done: true, ready: true });
      if (!video.data) return res.status(501).json({ error: "Video was returned as a cloud URI. Inline MP4 delivery is required for this browser export." });
      const buffer = Buffer.from(video.data, "base64");
      if (!buffer.length) return res.status(502).json({ error: "Gemini returned an empty video file." });
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Length", String(buffer.length));
      res.setHeader("Content-Disposition", 'attachment; filename="subas-ai-news-scene.mp4"');
      return res.status(200).send(buffer);
    }
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.error("Gemini Omni video API error:", error);
    return res.status(500).json({ error: error?.message || "Video service error." });
  }
}
