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
| `/` | Main portfolio — hero, about, work, tools, experience, contact |
| `/about.html` | About — the editor behind the frame: story, approach, career path, toolkit |
| `/subas-ghimire.html` | Nepali-language variant (`lang="ne"`, Mukta + Bricolage Grotesque) |
| `/cv.html` | Printable CV page with direct PDF download |
| `/effects.html` | Legacy redirect → `/` (effects hub retired) |

## Features

- **Dark / light theme toggle** with persisted preference
- **Scroll progress bar** and pointer-following ambient glow
- **Reveal-on-scroll** animations, all disabled under `prefers-reduced-motion`
- **Responsive** layout down to 360 px (collapsible mobile nav)
- **AI assistant** — serverless `/api/chat` endpoint backed by Gemini
- **Video generation demo** — `/api/video` wraps Google Veo 3.1
- **Downloadable CV** (PDF + HTML) and production-ready **LUTs / overlays / transitions** under `effects/`

## Tech stack

| Layer | Choice |
| --- | --- |
| Markup / styling | Hand-written HTML5 + CSS (no build step, no framework) |
| Behaviour | Vanilla JS — IntersectionObserver reveals, theme toggle, nav |
| Type | Google Fonts — Space Grotesk, DM Sans, Mukta, Bricolage Grotesque |
| Serverless | Vercel functions (`api/chat.js`, `api/video.js`) → Gemini / Veo |
| Hosting | Vercel (primary) + GitHub Pages (mirror) |

## Project structure

```
.
├── index.html                  # main portfolio (single file, inlined CSS)
├── about.html                  # dedicated About page (story, approach, path, toolkit)
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
