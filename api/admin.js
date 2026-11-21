// Private admin session endpoint. Configure ADMIN_CODE and ADMIN_SECRET in Vercel.
const crypto = require("crypto");
const COOKIE = "sg_admin";
const MAX_AGE = 60 * 60 * 8;

// Login brute-force protection (best-effort, in-memory per serverless instance).
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map(); // ip -> { count, until }
function ipOf(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}
function lockedFor(ip) {
  const f = fails.get(ip);
  if (!f) return 0;
  if (f.until && f.until > Date.now()) return f.until - Date.now();
  if (f.until && f.until <= Date.now()) fails.delete(ip);
  return 0;
}
function recordFail(ip) {
  const f = fails.get(ip) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS) { f.until = Date.now() + LOCK_MS; f.count = 0; }
  fails.set(ip, f);
  if (fails.size > 5000) for (const [k, v] of fails) if (!v.until || v.until <= Date.now()) fails.delete(k);
}

function sign(value, secret) { return crypto.createHmac("sha256", secret).update(value).digest("hex"); }
function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}
function cookieOf(req) {
  const raw = req.headers.cookie || "";
  const found = raw.split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="));
  return found ? decodeURIComponent(found.slice(COOKIE.length + 1)) : "";
}
function valid(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false;
  const expected = sign(parts[0], secret);
  if (expected.length !== parts[1].length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[1])) && Number(parts[0]) > Date.now();
}
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const secret = process.env.ADMIN_SECRET || "";
  const code = process.env.ADMIN_CODE || "";
  if (req.method === "GET") {
    const authenticated = valid(cookieOf(req), secret);
    const integrations = authenticated ? {
      github: Boolean(process.env.GITHUB_TOKEN),
      analytics: Boolean(process.env.GA4_MEASUREMENT_ID),
      voice: Boolean(process.env.ELEVENLABS_API_KEY),
      database: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    } : undefined;
    return res.status(200).json({ authenticated, configured: Boolean(secret && code), ...(integrations ? { integrations } : {}) });
  }
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!secret || !code) return res.status(503).json({ error: "Admin login is not configured. Add ADMIN_CODE and ADMIN_SECRET in Vercel Environment Variables." });
  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  if (origin) {
    let originHost = "";
    try { originHost = new URL(origin).host; } catch { /* invalid origin */ }
    if (originHost !== host) return res.status(403).json({ error: "Invalid origin" });
  }

  const ip = ipOf(req);
  const wait = lockedFor(ip);
  if (wait > 0) {
    res.setHeader("Retry-After", String(Math.ceil(wait / 1000)));
    return res.status(429).json({ error: "Too many attempts. Try again in " + Math.ceil(wait / 60000) + " minute(s)." });
  }

  const given = String(bodyOf(req).code || "");
  const a = Buffer.from(given), b = Buffer.from(code);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) { recordFail(ip); return res.status(401).json({ error: "Incorrect admin code" }); }
  fails.delete(ip);
  const expires = String(Date.now() + MAX_AGE * 1000);
  const token = expires + "." + sign(expires, secret);
  res.setHeader("Set-Cookie", COOKIE + "=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + MAX_AGE);
  return res.status(200).json({ ok: true, authenticated: true });
};
