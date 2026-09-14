/**
 * Anivexa API client — talks to your self-hosted Anivexa-API (recommended on Render).
 *
 * Set ANIVEXA_API_URL in env, e.g.:
 *   ANIVEXA_API_URL=https://your-anivexa.onrender.com
 *
 * Docs: https://github.com/walterwhite-69/Anivexa-API
 */

const DEFAULT_BASE = process.env.ANIVEXA_API_URL || '';

export function getAnivexaBase(): string {
  const base = (process.env.ANIVEXA_API_URL || DEFAULT_BASE || '').replace(/\/+$/, '');
  if (!base) {
    throw new Error(
      'ANIVEXA_API_URL is not set. Deploy Anivexa-API on Render and set the public URL in env.'
    );
  }
  return base;
}

export interface AnivexaStream {
  url: string;
  type: string; // 'hls' | 'embed' | 'mp4' | ...
  server?: string;
  referer?: string;
  priority?: number;
  isActive?: boolean;
  headers?: Record<string, string>;
  subtitles?: Array<{ url: string; label?: string; srclang?: string; default?: boolean }>;
}

export interface AnivexaWatchResponse {
  anilistId?: number;
  malId?: number;
  episode?: number;
  audio?: string;
  streams?: AnivexaStream[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  error?: string;
}

export interface AnivexaEpisodeItem {
  id?: string;
  number: number;
  title?: string;
  filler?: boolean;
  audio?: string;
}

export interface AnivexaProviderEpisodes {
  meta?: { title?: string; malId?: number };
  episodes?: {
    sub?: AnivexaEpisodeItem[];
    dub?: AnivexaEpisodeItem[];
  };
  error?: string;
}

export type AnivexaEpisodesResponse = Record<string, AnivexaProviderEpisodes>;

async function anivexaFetch<T>(path: string, timeoutMs = 45000): Promise<T> {
  const base = getAnivexaBase();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AniVault/1.0 (server; anivexa-import)',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anivexa HTTP ${res.status}: ${text.slice(0, 300) || res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Health / info */
export async function fetchAnivexaInfo(): Promise<{ name?: string; providers?: string[]; routes?: string[] }> {
  return anivexaFetch('/');
}

/** Cross-platform ID map (AniList → MAL etc.) */
export async function fetchAnivexaMap(anilistId: number | string) {
  return anivexaFetch<Record<string, any>>(`/map/${anilistId}`);
}

/**
 * Episode lists from all (or selected) providers.
 * providers: optional array e.g. ['reanime','anikoto','anizone']
 */
export async function fetchAnivexaEpisodes(
  anilistId: number | string,
  providers?: string[]
): Promise<AnivexaEpisodesResponse> {
  const id = Number(anilistId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid AniList ID');

  if (providers && providers.length > 0) {
    const path = `/episodes/${providers.join('/')}/${id}`;
    return anivexaFetch(path);
  }
  return anivexaFetch(`/episodes/${id}`);
}

/**
 * Stream sources for one episode from one provider.
 * Path pattern used by Anivexa: /watch/:provider/:anilistId/sub|dub/:provider-:ep
 */
export async function fetchAnivexaWatch(
  provider: string,
  anilistId: number | string,
  audio: 'sub' | 'dub',
  episode: number
): Promise<AnivexaWatchResponse> {
  const p = String(provider).toLowerCase().trim();
  const id = Number(anilistId);
  const ep = Number(episode);
  if (!p || !Number.isInteger(id) || id <= 0 || !Number.isInteger(ep) || ep <= 0) {
    throw new Error('Invalid provider / anilistId / episode');
  }
  const path = `/watch/${p}/${id}/${audio}/${p}-${ep}`;
  return anivexaFetch(path);
}

/** Preferred providers order for import (best quality / reliability first) */
export const PREFERRED_PROVIDERS = [
  'reanime',
  'anikoto',
  'anizone',
  'aniwaves',
  'animegg',
  'anineko',
  'mkissa',
  'senshi',
  'kaa',
  'animedunya',
  'animeonsen',
  '2dhive',
  'anibd',
  'anidbapp',
  'animenosub',
];

/**
 * Pick the best stream URL for embedding / playback.
 * Prefer embed-type when available (easy iframe), otherwise HLS.
 */
export function pickBestStream(streams: AnivexaStream[] | undefined): {
  url: string;
  type: string;
  server: string;
  referer?: string;
} | null {
  if (!streams?.length) return null;

  const active = streams.filter((s) => s.isActive !== false && s.url);
  const list = active.length ? active : streams.filter((s) => s.url);

  // Prefer embed for simple iframe playback in AniVault VideoPlayer
  const embed = list.find((s) => (s.type || '').toLowerCase() === 'embed');
  if (embed) {
    return {
      url: embed.url,
      type: 'embed',
      server: embed.server || 'Anivexa Embed',
      referer: embed.referer,
    };
  }

  // Otherwise first HLS / highest priority
  const sorted = [...list].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const best = sorted[0];
  return {
    url: best.url,
    type: best.type || 'hls',
    server: best.server || 'Anivexa',
    referer: best.referer,
  };
}

/**
 * Build a playable embed_url for AniVault's episode_servers table.
 * - If type is embed → use as-is (iframe)
 * - If type is hls → we still store the m3u8 URL; VideoPlayer can handle HLS or you can
 *   proxy / convert later. Many sources work as direct links with proper referer.
 */
export function streamToServerRow(
  stream: { url: string; type: string; server: string; referer?: string },
  language: 'sub' | 'dub'
) {
  return {
    language,
    server_name: `Anivexa ${stream.server} (${language.toUpperCase()})`,
    embed_url: stream.url,
    // optional future columns if you add them:
    // stream_type: stream.type,
    // referer: stream.referer || null,
  };
}
