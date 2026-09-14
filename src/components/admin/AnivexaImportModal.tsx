import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Search,
  Loader2,
  Tv,
  CheckCircle2,
  AlertCircle,
  Server,
} from 'lucide-react';
import { api } from '../../services/api';

interface AnivexaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: {
    anime: any;
    imported_episodes: number;
    mal_id?: number;
    anilist_id?: number;
  }) => void;
  showToast: (title: string, message: string, variant?: 'default' | 'destructive') => void;
  /** Optional prefill AniList ID */
  initialAnilistId?: number | string;
}

type SearchHit = {
  anilist_id: number | null;
  mal_id: number | null;
  title: string;
  cover?: string | null;
  year?: number | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
};

type PreviewData = {
  anilist_id: number;
  mal_id: number | null;
  providers: Record<string, { sub: number; dub: number; title?: string; error?: string }>;
  preferred: string[];
};

const DEFAULT_PROVIDERS = ['reanime', 'anikoto', 'anizone', 'aniwaves', 'animegg'];

export function AnivexaImportModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
  initialAnilistId,
}: AnivexaImportModalProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [anilistId, setAnilistId] = useState('');
  const [malIdOverride, setMalIdOverride] = useState('');
  const [maxEpisodes, setMaxEpisodes] = useState<string>('');
  const [startEpisode, setStartEpisode] = useState('1');
  const [animeOnly, setAnimeOnly] = useState(false);
  const [audio, setAudio] = useState<'sub' | 'dub' | 'both'>('both');
  const [selectedProviders, setSelectedProviders] = useState<string[]>(DEFAULT_PROVIDERS);

  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [info, setInfo] = useState<{ base_url?: string; providers?: string[]; name?: string } | null>(
    null
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setPreview(null);
    setLoading(false);
    setSearchResults([]);
    if (initialAnilistId) {
      setAnilistId(String(initialAnilistId));
    }
    // Check Anivexa connectivity
    api
      .getAnivexaInfo()
      .then((res) => setInfo(res))
      .catch(() =>
        setInfo(null)
      );
  }, [isOpen, initialAnilistId]);

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 2) {
      setError('Type at least 2 characters to search.');
      return;
    }
    setError('');
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await api.searchAnivexa(q);
      setSearchResults(res.data || []);
      if (!(res.data || []).length) {
        setError('No results. Try a different title or paste AniList ID directly.');
      }
    } catch (e: any) {
      setError(e.message || 'Search failed.');
    } finally {
      setSearchLoading(false);
    }
  }

  function selectHit(hit: SearchHit) {
    if (hit.anilist_id) setAnilistId(String(hit.anilist_id));
    if (hit.mal_id) setMalIdOverride(String(hit.mal_id));
    setPreview(null);
    setError('');
  }

  async function handlePreview() {
    const id = Number(anilistId);
    if (!Number.isInteger(id) || id <= 0) {
      setError('Enter a valid AniList ID (or search and select one).');
      return;
    }
    setError('');
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await api.previewAnivexa(id, selectedProviders);
      setPreview(res);
    } catch (e: any) {
      setError(e.message || 'Preview failed. Is Anivexa running on Render?');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleImport() {
    const id = Number(anilistId);
    if (!Number.isInteger(id) || id <= 0) {
      setError('Enter a valid AniList ID.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload: any = {
        anilistId: id,
        startEpisode: Number(startEpisode) || 1,
        animeOnly,
        audio,
        providers: selectedProviders,
      };
      if (maxEpisodes.trim()) payload.maxEpisodes = Number(maxEpisodes);
      if (malIdOverride.trim()) payload.malId = Number(malIdOverride);

      const res = await api.importFromAnivexa(payload);
      showToast(
        'Import complete',
        res.message || `Imported ${res.imported_episodes} episode(s).`
      );
      onSuccess({
        anime: res.anime,
        imported_episodes: res.imported_episodes,
        mal_id: res.mal_id,
        anilist_id: res.anilist_id,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Import failed.');
      showToast('Import failed', e.message || 'Could not import from Anivexa.', 'destructive');
    } finally {
      setLoading(false);
    }
  }

  function toggleProvider(p: string) {
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  if (!isOpen) return null;

  const allProviders = info?.providers?.length ? info.providers : DEFAULT_PROVIDERS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-900/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-lg font-bold text-white">Import from Anivexa</h2>
            <p className="text-xs text-zinc-400">
              Search anime → choose providers → import episode embeds into Supabase
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Connectivity status */}
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              info?.base_url
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}
          >
            <Server className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {info?.base_url ? (
                <>
                  <span className="font-medium">Connected:</span> {info.name || 'Anivexa'} @{' '}
                  <code className="text-xs">{info.base_url}</code>
                </>
              ) : (
                <>
                  Anivexa not reachable. Deploy{' '}
                  <a
                    href="https://github.com/walterwhite-69/Anivexa-API"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Anivexa-API
                  </a>{' '}
                  on Render and set <code className="text-xs">ANIVEXA_API_URL</code> in your
                  environment.
                </>
              )}
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Search anime (title)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. One Piece, Attack on Titan..."
                className="flex-1 rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={searchLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {searchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                {searchResults.map((hit, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectHit(hit)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
                  >
                    {hit.cover ? (
                      <img
                        src={hit.cover}
                        alt=""
                        className="h-12 w-9 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-9 items-center justify-center rounded bg-zinc-700">
                        <Tv className="h-4 w-4 text-zinc-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{hit.title}</div>
                      <div className="text-xs text-zinc-400">
                        {hit.year || '—'} · {hit.format || '—'}
                        {hit.anilist_id != null && ` · AL ${hit.anilist_id}`}
                        {hit.mal_id != null && ` · MAL ${hit.mal_id}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* IDs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                AniList ID *
              </label>
              <input
                type="number"
                value={anilistId}
                onChange={(e) => setAnilistId(e.target.value)}
                placeholder="e.g. 16498"
                className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                MAL ID (optional override)
              </label>
              <input
                type="number"
                value={malIdOverride}
                onChange={(e) => setMalIdOverride(e.target.value)}
                placeholder="Auto from Anivexa map"
                className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Providers */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Providers (select which sources to import)
            </label>
            <div className="flex flex-wrap gap-2">
              {allProviders.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProvider(p)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    selectedProviders.includes(p)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Start episode
              </label>
              <input
                type="number"
                min={1}
                value={startEpisode}
                onChange={(e) => setStartEpisode(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Max episodes
              </label>
              <input
                type="number"
                min={1}
                value={maxEpisodes}
                onChange={(e) => setMaxEpisodes(e.target.value)}
                placeholder="All"
                className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Audio</label>
              <select
                value={audio}
                onChange={(e) => setAudio(e.target.value as any)}
                className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="both">Sub + Dub</option>
                <option value="sub">Sub only</option>
                <option value="dub">Dub only</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={animeOnly}
              onChange={(e) => setAnimeOnly(e.target.checked)}
              className="rounded border-white/20"
            />
            Anime details only (skip episodes)
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-white/10 bg-zinc-800/50 p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium text-white">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Preview — AniList {preview.anilist_id}
                {preview.mal_id ? ` · MAL ${preview.mal_id}` : ''}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-zinc-300 sm:grid-cols-3">
                {Object.entries(preview.providers).map(([prov, stats]) => (
                  <div key={prov} className="rounded bg-zinc-900/80 px-2 py-1">
                    <span className="font-medium text-zinc-200">{prov}</span>
                    {stats.error ? (
                      <span className="ml-1 text-red-400">err</span>
                    ) : (
                      <span className="ml-1 text-zinc-400">
                        sub:{stats.sub} dub:{stats.dub}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handlePreview}
              disabled={previewLoading || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {previewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Tv className="h-4 w-4" />
              )}
              Preview
            </button>
            <button
              onClick={handleImport}
              disabled={loading || previewLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Import now
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Import fetches streams from your Render-hosted Anivexa-API and saves them as episode
            servers in Supabase. Prefer fewer providers for faster imports. Free Render services
            may sleep — first request can take ~30–60s.
          </p>
        </div>
      </div>
    </div>
  );
}
