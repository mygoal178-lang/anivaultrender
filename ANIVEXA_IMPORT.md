# Anivexa API Import (Admin + Render)

## What this adds

- **Import from Anivexa** button in Admin → Episodes
- **Search by title** inside the import modal (AniList-powered)
- Select **providers** (reanime, anikoto, anizone, …)
- Choose **start episode**, **max episodes**, **sub/dub/both**
- Streams/embeds are saved into your Supabase `episodes` + `episode_servers` tables

## Architecture

```
[Your Vercel site / AniVault]
        │
        │  Admin calls /api/admin/anivexa/*
        ▼
[AniVault server (Vercel serverless or Node)]
        │
        │  ANIVEXA_API_URL
        ▼
[Anivexa-API on Render]  ← scrapes providers, returns HLS/embed links
        │
        ▼
[Supabase]  ← anime + episodes + episode_servers
```

## 1. Deploy Anivexa-API on Render (required)

1. Fork or clone: https://github.com/walterwhite-69/Anivexa-API
2. Render → New → Web Service → connect the repo
3. Settings:
   - Build: `npm install`
   - Start: `node server.js`
   - Env: `PORT=10000` (Render sets PORT automatically; optional)
   - `CACHE_ENABLED=true` (recommended)
4. Deploy → copy the public URL, e.g. `https://anivexa-api-xxxx.onrender.com`

**Free tier note:** Render sleeps after inactivity. First request after sleep can take 30–60s. Use a free uptime pinger if needed.

**Do not** run Anivexa on Vercel — most anime providers block Vercel IPs.

## 2. Configure AniVault

In Vercel (or local `.env.local`) add:

```
ANIVEXA_API_URL=https://your-anivexa.onrender.com
```

Redeploy AniVault after adding the env var.

## 3. Use in Admin

1. Open **Admin → Episodes**
2. Click **Import from Anivexa** (indigo button)
3. Search anime by title **or** paste AniList ID
4. (Optional) Preview providers / episode counts
5. Select providers, start/max episode, audio
6. **Import now**

Anime is keyed by **MAL ID** (`external_id`). Episodes get servers named like `Anivexa Reanime (SUB)`.

## API routes (admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/anivexa/info` | Connectivity + providers |
| GET | `/api/admin/anivexa/search?q=` | Title search |
| GET | `/api/admin/anivexa/preview/:anilistId` | Episode counts per provider |
| POST | `/api/admin/anivexa/import` | Import into Supabase |

## Tips

- Start with 1–2 providers (`reanime`, `anikoto`) for faster imports.
- Prefer **embed** type streams when available (works with existing VideoPlayer iframes).
- HLS links also work if your player supports hls.js.
- Anikoto import remains available as a second source.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "ANIVEXA_API_URL is not set" | Add env var and redeploy |
| 502 / timeout | Render service sleeping — wait or ping it |
| No MAL ID | Provide `malId` override in the modal |
| Empty streams | Provider blocked or captcha — try another provider |
