/**
 * Extra Anivexa admin routes: watch streams + embed URL testing.
 * Mounted from server/app.ts via registerAnivexaExtraRoutes(app).
 */
import type { Express } from 'express';
import { requireAdmin, AuthenticatedRequest } from './auth.js';
import { fetchAnivexaWatch } from './anivexa.js';

export function registerAnivexaExtraRoutes(app: Express): void {
  /**
   * Fetch streams for one provider + episode (admin testing / full control).
   * Query: provider, anilistId, audio=sub|dub, episode
   */
  app.get('/api/admin/anivexa/watch', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const provider = String(req.query.provider || '').toLowerCase().trim();
      const anilistId = Number(req.query.anilistId ?? req.query.anilist_id);
      const audioRaw = String(req.query.audio || 'sub').toLowerCase();
      const audio = audioRaw === 'dub' ? 'dub' : 'sub';
      const episode = Number(req.query.episode ?? req.query.ep ?? 1);

      if (!provider) {
        return res.status(400).json({ error: 'provider query param is required.' });
      }
      if (!Number.isInteger(anilistId) || anilistId <= 0) {
        return res.status(400).json({ error: 'Valid anilistId is required.' });
      }
      if (!Number.isInteger(episode) || episode <= 0) {
        return res.status(400).json({ error: 'Valid episode number is required.' });
      }

      const watch = await fetchAnivexaWatch(provider, anilistId, audio, episode);
      res.json({
        provider,
        anilist_id: anilistId,
        episode,
        audio,
        streams: watch?.streams || [],
        intro: watch?.intro || null,
        outro: watch?.outro || null,
        mal_id: watch?.malId || null,
        error: watch?.error || null,
      });
    } catch (err: any) {
      res.status(502).json({
        error: err.message || 'Failed to fetch Anivexa watch streams.',
        streams: [],
      });
    }
  });

  /**
   * Test whether an embed / stream URL is reachable (admin quality check).
   * Body: { url: string }
   * Uses HEAD then GET fallback; does not download full media.
   */
  app.post('/api/admin/anivexa/test-embed', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const url = String(req.body?.url || '').trim();
      if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ ok: false, error: 'Valid http(s) url is required.' });
      }

      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      try {
        let status = 0;
        let contentType = '';
        let methodUsed = 'HEAD';

        let response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': 'AniVault/1.0 (admin; embed-check)',
            Accept: '*/*',
          },
        }).catch(() => null);

        if (!response || response.status === 405 || response.status === 501) {
          methodUsed = 'GET';
          response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              'User-Agent': 'AniVault/1.0 (admin; embed-check)',
              Accept: '*/*',
              Range: 'bytes=0-0',
            },
          });
        }

        if (!response) {
          return res.json({
            ok: false,
            error: 'No response from URL',
            latencyMs: Date.now() - started,
          });
        }

        status = response.status;
        contentType = response.headers.get('content-type') || '';
        try {
          await response.body?.cancel?.();
        } catch {
          /* ignore */
        }

        const ok = status >= 200 && status < 400;
        res.json({
          ok,
          status,
          contentType,
          method: methodUsed,
          latencyMs: Date.now() - started,
          error: ok ? undefined : `HTTP ${status}`,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? 'Timeout after 12s' : err.message || 'Test failed';
      res.json({ ok: false, error: msg });
    }
  });
}
