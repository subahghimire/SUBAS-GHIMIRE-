export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

  try {
    if (req.method === "POST") {
      const { prompt, model = "veo-3.1-fast-generate-preview", aspectRatio = "16:9", resolution = "720p" } = req.body || {};

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Video prompt is required" });
      }

      const allowedModels = [
        "veo-3.1-generate-preview",
        "veo-3.1-fast-generate-preview",
        "veo-3.1-lite-generate-preview"
      ];

      if (!allowedModels.includes(model)) {
        return res.status(400).json({ error: "Invalid video model" });
      }

      const response = await fetch(
        `${BASE_URL}/models/${model}:predictLongRunning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            instances: [{ prompt: prompt.slice(0, 10000) }],
            parameters: {
              aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9",
              resolution: resolution === "1080p" ? "1080p" : "720p",
              numberOfVideos: 1
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.error?.message || "Video generation request failed"
        });
      }

      return res.status(200).json({
        operation: data?.name || null,
        model,
        message: "Video generation started."
      });
    }

    if (req.method === "GET") {
      const operation = req.query?.operation;
      const download = req.query?.download === "1";

      if (!operation || typeof operation !== "string") {
        return res.status(400).json({ error: "Operation is required" });
      }

      if (!/^models\/[^/]+:predictLongRunning\/[^/]+$/.test(operation) && !/^operations\//.test(operation)) {
        return res.status(400).json({ error: "Invalid operation" });
      }

      const statusResponse = await fetch(
        `${BASE_URL}/${operation.replace(/^\//, "")}`,
        {
          headers: { "x-goog-api-key": apiKey }
        }
      );

      const data = await statusResponse.json();

      if (!statusResponse.ok) {
        return res.status(statusResponse.status).json({
          error: data?.error?.message || "Could not check video status"
        });
      }

      if (!data.done) {
        return res.status(200).json({ done: false });
      }

      if (data.error) {
        return res.status(400).json({
          done: true,
          error: data.error.message || "Video generation failed"
        });
      }

      const videoUri =
        data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
        data?.response?.generatedVideos?.[0]?.video?.uri;

      if (!videoUri) {
        return res.status(500).json({ done: true, error: "Video completed but no video file was returned." });
      }

      if (!download) {
        return res.status(200).json({ done: true, ready: true });
      }

      const videoResponse = await fetch(videoUri, {
        headers: { "x-goog-api-key": apiKey }
      });

      if (!videoResponse.ok) {
        const errorText = await videoResponse.text();
        return res.status(videoResponse.status).json({
          error: errorText || "Could not download generated video"
        });
      }

      const buffer = Buffer.from(await videoResponse.arrayBuffer());
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", 'attachment; filename="subas-ai-video.mp4"');
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(buffer);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Veo video API error:", error);
    return res.status(500).json({ error: error?.message || "Video service error" });
  }
}
