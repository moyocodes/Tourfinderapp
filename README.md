# TourFinderApp — web frontend

The chat UI for **TourFinderApp**, a world tourism chatbot. Talks to a private
FastAPI backend (closed-source; see **Backend**, below, for what it does).

Vite + React 19 + Tailwind 4. Neon-glass visual identity with light / dark /
system themes and a swappable background.

## Features

- **Chat** with markdown-rendered replies and an intent tag per answer
- **Place cards** — search results shown as ticket-stub cards (name, address,
  rating and hours where available), in a horizontal rail
- **Sessions** — conversation list in the left sidebar, stored in `localStorage`
  so it survives restarts; resume or delete any past chat
- **Free-plan meter** — live usage count from the backend (`GET /usage`)
- **Location** — a "use my location" button for precise results; the backend also
  guesses your country from IP with no prompt
- **Themes** — light / dark / follow-system, toggled in the header
- **Backgrounds** — six CSS-generated wallpapers plus "paste any image URL",
  chosen from the palette menu; persists per device

## Backend

The backend is a private Python/FastAPI service (not open-sourced) that this
frontend talks to over `POST /chat` and a few supporting endpoints. What it
does:

- **Hybrid LLM routing** — a self-hosted fine-tuned model (served via
  [Ollama](https://ollama.com)) answers straightforward questions for free;
  anything safety-critical, time-sensitive, place-lookup-dependent, or a
  follow-up turn routes to Claude (Anthropic) instead. Keeps cost-per-conversation
  low without sacrificing answer quality on hard questions.
- **Claude tool-use loop** — Claude decides when to call a place-search tool
  (OpenStreetMap by default, no API key required) or a web-search fallback for
  things like live events or safety advisories.
- **Real place data, free by default** — search runs on OpenStreetMap
  (Nominatim); can optionally switch to Google Places for richer data
  (ratings, hours, photos) if configured with billing.
- **Location without a permission prompt** — country is guessed silently from
  request IP on page load; the user can opt into precise city-level location.
- **Persistent conversations** — sessions are written to disk, so a backend
  restart doesn't lose context mid-chat.
- **Free-plan usage metering** — tracks daily message counts per client and
  exposes them to this frontend via `GET /usage`.
- **Training-data logging** — every Claude-answered interaction is logged,
  feeding future fine-tunes of the local model.

Deployed on [Render](https://render.com), chosen over serverless platforms
because it needs a real persistent filesystem for session history and
training-data logs.

## Running it

```bash
npm install
npm run dev
```

Opens on <http://localhost:5173>. In dev, `/api/*` is proxied to the backend on
`http://127.0.0.1:8000` (see [`vite.config.js`](vite.config.js)) — **start the
backend first**.

For production, set the backend URL:

```
VITE_API_BASE_URL=https://your-backend.example.com
```

## Layout

```
src/
  App.jsx                  top-level layout + chat state
  api/chat.js              every backend call
  useSessions.js           localStorage-backed conversation list
  useTheme.js              light / dark / system
  useWallpaper.js          background choice + custom image
  wallpapers.js            the CSS-generated background presets
  components/
    Sidebar.jsx            session list + free-plan meter
    Markdown.jsx           minimal safe markdown renderer (no innerHTML)
    PlaceCard.jsx          a single place result
    WallpaperPicker.jsx    background menu
```

## Build

```bash
npm run build      # → dist/
npm run preview    # serve the build locally
```

## Deploying (Vercel)

This repo deploys to Vercel as a static site ([`vercel.json`](vercel.json) pins
the Vite preset and the SPA rewrite).

1. Push this repo to GitHub.
2. In the Vercel dashboard: **Add New → Project → Import** this repo.
   Framework preset, build command and output dir are picked up from
   `vercel.json` — leave them as detected.
3. Under **Settings → Environment Variables**, add for **Production** (and
   Preview if you want branch deploys to hit the live backend):

   | Name | Value |
   |------|-------|
   | `VITE_API_BASE_URL` | `https://<your-render-service>.onrender.com` |

   No trailing slash. This is baked in at build time, so **redeploy after
   changing it**.
4. Deploy. Every push to the default branch ships to production; PRs get
   preview URLs.

After the backend is live, its `CORS_ORIGINS` config needs this frontend's URL
added (backend repo is private).
