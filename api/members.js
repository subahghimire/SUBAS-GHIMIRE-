// Members area gate: one shared access code, HMAC-signed HttpOnly session.
// Env: MEMBERS_CODE (the code to hand out), MEMBERS_SECRET (cookie signing key).
const crypto = require('crypto');

const COOKIE = 'sg_member';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const code = process.env.MEMBERS_CODE || '';
const secret = process.env.MEMBERS_SECRET || '';

function sign(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function issue() {
  const payload = `v1.${Date.now() + MAX_AGE * 1000}`;
  return `${payload}.${sign(payload)}`;
}

function isValid(token) {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  if (expected.length !== parts[2].length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) return false;
  return Number(parts[1]) > Date.now();
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

function parseBody(req) {
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    const out = {};
    for (const pair of body.split('&')) {
      const i = pair.indexOf('=');
      if (i < 0) continue;
      out[decodeURIComponent(pair.slice(0, i).replace(/\+/g, ' '))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    }
    return out;
  }
  return body && typeof body === 'object' ? body : {};
}

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#080611">
<title>${title} | Subas Ghimire</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap">
<style>
:root{--bg:#080611;--panel:#171027;--line:#b885ff2b;--green:#a855f7;--mint:#d8b4fe;--white:#f8f4ff;--muted:#b3a8c2}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;padding:36px 22px 60px;
 background:radial-gradient(ellipse at 78% 6%,#a855f71e,transparent 42%),radial-gradient(ellipse at 8% 92%,#7c3aed18,transparent 40%),var(--bg);
 color:var(--white);font-family:"DM Sans",system-ui,sans-serif}
.wrap{width:min(940px,100%);margin:0 auto}
.top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:44px}
.brand{display:flex;align-items:center;gap:11px;font:700 13px "Space Grotesk",sans-serif;letter-spacing:1px}
.mark{width:34px;height:34px;border:1px solid var(--green);border-radius:8px;display:grid;place-items:center;color:var(--green);font-size:12px}
a{color:inherit;text-decoration:none}
.logout{font:700 10px "Space Grotesk",sans-serif;letter-spacing:1.4px;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:9px 14px}
.logout:hover{color:var(--green);border-color:var(--green)}
.kicker{font:600 10px "Space Grotesk",sans-serif;letter-spacing:2.2px;color:var(--green)}
h1{font:700 clamp(34px,6vw,54px)/1.05 "Space Grotesk",sans-serif;letter-spacing:-1.6px;margin:14px 0 12px}
h1 em{color:var(--green);font-style:normal}
.lead{color:var(--muted);max-width:52ch;line-height:1.7;margin:0 0 34px;font-size:15px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.card{border:1px solid var(--line);border-radius:14px;padding:22px;background:#17102780}
.card h2{font:600 15px "Space Grotesk",sans-serif;margin:0 0 8px;letter-spacing:.2px}
.card p{color:var(--muted);font-size:13.5px;line-height:1.65;margin:0 0 16px}
.card a.cta{font:700 10px "Space Grotesk",sans-serif;letter-spacing:1.3px;color:var(--green)}
.card a.cta:hover{color:var(--mint)}
.foot{margin-top:34px;color:#8a7aa0;font-size:11px;letter-spacing:.5px}
@media(max-width:640px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;

const top = `<div class="top"><a class="brand" href="/"><span class="mark">SG</span><span>SUBAS GHIMIRE</span></a><a class="logout" href="/api/logout">LOG OUT ↗</a></div>`;

const membersHtml = page('Client room', `${top}
<span class="kicker">CLIENT ROOM</span>
<h1>Welcome <em>back.</em></h1>
<p class="lead">Everything for an active project in one place. This room is private — the link and code are only for people working with me.</p>
<div class="grid">
  <div class="card"><h2>Book a slot</h2><p>Tell me the project, the deadline and how much footage is coming. I will confirm the window and what I need from you.</p><a class="cta" href="mailto:ghimiresubas347@gmail.com?subject=Booking%20enquiry">REQUEST A SLOT ↗</a></div>
  <div class="card"><h2>Rate card</h2><p>Editing, motion graphics, colour and short-form — sent as a one-page PDF with day rates and what each package includes.</p><a class="cta" href="mailto:ghimiresubas347@gmail.com?subject=Rate%20card%20request">ASK FOR THE RATE CARD ↗</a></div>
  <div class="card"><h2>Send footage</h2><p>Drive, WeTransfer or FTP all work. Send the link with the target length, the deadline and any reference cuts.</p><a class="cta" href="mailto:ghimiresubas347@gmail.com?subject=Footage%20link">SEND A LINK ↗</a></div>
  <div class="card"><h2>See the work</h2><p>Broadcast edits, talk shows and short-form pieces — the public portfolio and the case studies.</p><a class="cta" href="/#work">PORTFOLIO ↗</a> &nbsp; <a class="cta" href="/work.html">CASE STUDIES ↗</a></div>
</div>
<p class="foot">SUBAS GHIMIRE · VIDEO EDITOR · KATHMANDU, NEPAL · +977 9766454587</p>`);

module.exports = (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    const body = parseBody(req);
    const given = String(body.code || '').trim();
    const ok = code && given.length === code.length &&
      crypto.timingSafeEqual(Buffer.from(given), Buffer.from(code));
    if (!ok) {
      res.statusCode = 303;
      res.setHeader('Location', '/members.html?e=1');
      return res.end();
    }
    res.statusCode = 303;
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(issue())}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
    res.setHeader('Location', '/members');
    return res.end();
  }

  if (!isValid(readCookie(req, COOKIE))) {
    res.statusCode = 303;
    res.setHeader('Location', '/members.html');
    return res.end();
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(membersHtml);
};
