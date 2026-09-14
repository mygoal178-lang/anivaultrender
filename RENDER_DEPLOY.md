# Deploy AniVault on Render

## Web Service settings

| Field | Value |
|--------|--------|
| **Root Directory** | *(leave empty)* |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

## Environment variables

```
NODE_ENV=production

VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

ANIVEXA_API_URL=https://your-anivexa-api.onrender.com
```

## Notes

- Node is pinned to **22.x** (required by recent `@supabase/supabase-js`).
- `ws` is included so WebSocket works even if Node is older.
- `npm start` runs the **full website** (frontend + API).
- Deploy **Anivexa-API** as a separate Render service, then set `ANIVEXA_API_URL`.
