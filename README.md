<div align="center">

# Subas Ghimire

**Video Editor · Visual Editor · Post-Production**

Personal portfolio of **Subas Ghimire** — video editor and visual editor at Kantipur Television, Nepal.

[![Live site](https://img.shields.io/badge/live-subas--ghimire.vercel.app-00d6a0?style=flat-square)](https://subas-ghimire.vercel.app)
[![GitHub Pages](https://img.shields.io/badge/mirror-github.io-00d6a0?style=flat-square)](https://subahghimire.github.io/SUBAS-GHIMIRE-/)
[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](#tech-stack)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](#deployment)
[![License](https://img.shields.io/badge/license-personal-9cb1a5?style=flat-square)](#license)

[**Live site ↗**](https://subas-ghimire.vercel.app) &nbsp;·&nbsp; [Nepali version](https://subas-ghimire.vercel.app/subas-ghimire.html) &nbsp;·&nbsp; [CV](https://subas-ghimire.vercel.app/cv.html) &nbsp;·&nbsp; [Email](mailto:ghimiresubas347@gmail.com)

</div>

---

## Members area

`/members.html` is the login screen; `/members` is the room itself, rendered by the
`api/members.js` serverless function. It is a **single shared access code**, not per-user
accounts: hand the code to a client and they are in until the code changes.

`/signup.html` is the front door for that room — a small FormSubmit form (name, email,
optional project) that lands in the inbox. Reply with the access code and the client is in.
The link sits next to **Tools** in the main nav and from the members login screen.

Set two environment variables in the Vercel project (Settings → Environment Variables):

| Name | Value |
| --- | --- |
| `MEMBERS_CODE` | the code you give to clients (change it to revoke access) |
| `MEMBERS_SECRET` | any long random string — signs the session cookie |

The session is an HttpOnly, Secure, SameSite=Lax cookie valid for 30 days; `/api/logout`
clears it. Both routes send `X-Robots-Tag: noindex`, are blocked in `robots.txt`, and are
left out of the sitemap.

Changing `MEMBERS_CODE` logs everyone out on their next visit.

## Finishing touches

- **Worked-with strip** — Kantipur Television, Global Television HD and Janata Television, taken straight from the CV.
- **How it works** — brief → rough cut → finish, sitting under the service cards.
- **Contact actions** — WhatsApp deep link, a copy-email button with a live status line, and a `subas-ghimire.vcf` card for one-tap saving.
- **Brief builder** — pick services, footage length and a date; it writes a structured brief into the message field.
- **Scrollspy nav** — the section you are reading is marked with `aria-current`.
- **Kathmandu clock** — live NPT time in the footer.
- **CV QR** — inline SVG QR to the live site, sized for print.
- **Case studies** — `/work.html` breaks down each format: the brief, what happens in the timeline, what gets delivered.
- **PWA shortcuts** — Work, CV, Contact and Client room from the installed icon.
- **404 quick links** — the useful routes instead of a dead end.

## Contact form

The home page form posts to [FormSubmit](https://formsubmit.co) and needs no backend or API key.

- First submission sends a one-time activation email to `ghimiresubas347@gmail.com` — click it once, then every later message is delivered.
- Success redirects to `thanks.html`; the `_honey` field is a spam honeypot.
- Spam guard is `_captcha=false` plus the honeypot, so keep the honeypot field hidden.
- `_autoresponse` sends the submitter an instant confirmation (Nepali + English) with the phone number.

## Custom domain

`scripts/set-domain.sh <domain>` rewrites every absolute URL (canonical, og/twitter,
JSON-LD, sitemap, robots, README) in one pass:

```bash
./scripts/set-domain.sh subasghimire.com.np
```

Then add the domain in Vercel and point the registrar's nameservers at
`ns1.vercel-dns.com` / `ns2.vercel-dns.com`. The script prints the full checklist.

## About

A single-page portfolio built to feel like a title sequence: dark cinematic palette, mint-green accents,
motion-driven reveals and a typography pairing of **Space Grotesk** + **DM Sans**.

It covers the work (editing, visual storytelling, post-production), the tools used day to day
(Premiere Pro, After Effects, DaVinci Resolve), a professional timeline, and a downloadable CV.

## Sections

| Route | What it is |
| --- | --- |
| `/` | Main portfolio — hero, about, work, services, tools, experience, FAQ, contact |
| `/about.html` | About — the editor behind the frame: story, approach, career path, toolkit |
| `/work.html` | Case studies — how news packages, talk shows, motion graphics and vertical cuts are made |
| `/subas-ghimire.html` | Nepali-language portfolio (`lang="ne"`, Mukta + Space Grotesk) |
| `/cv.html` | Printable CV page with direct PDF download |
| `/thanks.html` | Contact-form confirmation (noindex, 12 s redirect home) |
| `/signup.html` | Client-room access request — name/email form → inbox |
| `/signup-thanks.html` | Access-request confirmation (noindex, redirect to login) |
| `/effects.html` | Editing assets library — MP4 previews, LUTs, overlays, transitions and broadcast graphics |
| `/CV/Subas_Ghimire_CV.html` | Old CV page — 301 to `/cv.html` |

## SEO

- Unique title + description per page, keyword-led (`video editor Nepal`, `Kathmandu`)
- JSON-LD `@graph`: `Person`, `WebSite`, `FAQPage` (home), `AboutPage` / `ProfilePage` + `BreadcrumbList` (subpages)
- FAQ section on the home page mirrors the `FAQPage` markup word for word
- `hreflang` en / ne / x-default, `rel="me"` on social links, image entry in the sitemap
- 301s for `/index.html`, the retired effects hub and the old CV page
- Hero ships WebP with a JPEG fallback, preloaded for LCP

## Features

- **Dark / light theme toggle** with persisted preference
- **Scroll progress bar** and pointer-following ambient glow
- **Reveal-on-scroll** animations, all disabled under `prefers-reduced-motion`
- **Responsive** layout down to 360 px (collapsible mobile nav)
- **AI assistant** — serverless `/api/chat` endpoint backed by Gemini
- **Video generation demo** — `/api/video` wraps Google Veo 3.1
- **Downloadable CV** (PDF + HTML) and an **editing assets library** with MP4 previews, LUTs, overlays, transitions and broadcast graphics under `effects/`

## Tech stack

| Layer | Choice |
| --- | --- |
| Markup / styling | Hand-written HTML5 + CSS (no build step, no framework) |
| Behaviour | Vanilla JS — IntersectionObserver reveals, theme toggle, nav |
| Type | Google Fonts — Space Grotesk, DM Sans, Mukta |
| Serverless | Vercel functions (`api/chat.js`, `api/video.js`) → Gemini / Veo |
| Hosting | Vercel (primary) + GitHub Pages (mirror) |

## Project structure

```
.
├── index.html                  # main portfolio (single file, inlined CSS)
├── about.html                  # dedicated About page (story, approach, path, toolkit)
├── work.html                   # case studies — brief, process and delivery per format
├── subas-ghimire.html          # Nepali-language variant
├── cv.html                     # printable CV
├── api/
│   ├── chat.js                 # Gemini chat endpoint
│   └── video.js                # Veo 3.1 video generation endpoint
├── assets/social/              # Facebook, Instagram, TikTok, WhatsApp icons
├── effects/                    # LUTs, overlays, transitions, motion assets
├── CV/                         # CV in PDF + HTML
├── robots.txt · sitemap.xml    # SEO
├── scripts/set-domain.sh       # repoint every absolute URL at a new domain
└── .github/workflows/          # maintenance workflow
```

## Run locally

No tooling required — it is static HTML:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

The serverless endpoints need environment variables to work locally:

```bash
export GEMINI_API_KEY="your-key"
vercel dev
```

## Deployment

- **Vercel** — every push to `main` deploys to <https://subas-ghimire.vercel.app>
- **GitHub Pages** — mirrors the same branch at <https://subahghimire.github.io/SUBAS-GHIMIRE-/>

## Contact

- **Email** — [ghimiresubas347@gmail.com](mailto:ghimiresubas347@gmail.com)
- **Phone** — +977 9766454587
- **GitHub** — [@subahghimire](https://github.com/subahghimire)

## License

Personal portfolio — content, photography and showreel footage are © Subas Ghimire, all rights reserved.
The code may be read and learned from; please do not republish the content as your own.
