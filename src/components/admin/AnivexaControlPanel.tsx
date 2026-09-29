import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Loader2,
  Server,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Download,
  Play,
  RefreshCw,
  Tv,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api';

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

type ProviderStats = {
  sub: number;
  dub: number;
  title?: string;
  error?: string;
};

type StreamItem = {
  url: string;
  type: string;
  server?: string;
  referer?: string;
  priority?: number;
  isActive?: boolean;
};

type TestResult = {
  ok: boolean;
  status?: number;
  contentType?: string;
  error?: string;
  latencyMs?: number;
};

const FALLBACK_PROVIDERS = [
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

interface AnivexaControlPanelProps {
  showToast: (title: string, message: string, variant?: 'default' | 'destructive') => void;
  onImported?: () => void;
}

export function AnivexaControlPanel({ showToast, onImported }: AnivexaControlPanelProps) {
  const [info, setInfo] = useState<{
    ok?: boolean;
    base_url?: string;
    name?: string;
    providers?: string[];
  } | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [anilistId, setAnilistId] = useState('');
  const [malIdOverride, setMalIdOverride] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');

  const [allProviders, setAllProviders] = useState<string[]>(FALLBACK_PROVIDERS);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    'reanime',
    'anikoto',
    'anizone',
  ]);

  const [preview, setPreview] = useState<Record<string, ProviderStats> | null>(null);
  const [previewMalId, setPreviewMalId] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [testProvider, setTestProvider] = useState('reanime');
  const [testEpisode, setTestEpisode] = useState('1');
  const [testAudio, setTestAudio] = useState<'sub' | 'dub'>('sub');
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingUrl, setTestingUrl] = useState<string | null>(null);

  const [startEpisode, setStartEpisode] = useState('1');
  const [maxEpisodes, setMaxEpisodes] = useState('');
  const [audio, setAudio] = useState<'sub' | 'dub' | 'both'>('both');
  const [animeOnly, setAnimeOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [lastImportMsg, setLastImportMsg] = useState('');

  const loadInfo = useCallback(async () => {
    setInfoLoading(true);
    setError('');
    try {
      const res = await api.getAnivexaInfo();
      setInfo(res);
      const providers =
        res.providers && res.providers.length ? res.providers : FALLBACK_PROVIDERS;
      setAllProviders(providers);
      setSelectedProviders((prev) => {
        const valid = prev.filter((p) => providers.includes(p));
        return valid.length ? valid : providers.slice(0, 3);
      });
    } catch (e: any) {
      setInfo(null);
      setError(e.message || 'Cannot reach Anivexa API');
    } finally {
      setInfoLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

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
        setError('No results. Try another title or paste AniList ID below.');
      }
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }

  function selectHit(hit: SearchHit) {
    if (hit.anilist_id) setAnilistId(String(hit.anilist_id));
    if (hit.mal_id) setMalIdOverride(String(hit.mal_id));
    setSelectedTitle(hit.title || '');
    setPreview(null);
    setStreams([]);
    setTestResults({});
    setError('');
  }

  function toggleProvider(p: string) {
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function selectAllProviders() {
    setSelectedProviders([...allProviders]);
  }

  function selectNoneProviders() {
    setSelectedProviders([]);
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
      const res = await api.previewAnivexa(
        id,
        selectedProviders.length ? selectedProviders : undefined
      );
      setPreview(res.providers || {});
      setPreviewMalId(res.mal_id ?? null);
      if (res.mal_id && !malIdOverride) setMalIdOverride(String(res.mal_id));
    } catch (e: any) {
      setError(e.message || 'Preview failed. Is Anivexa running on Render?');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleFetchStreams() {
    const id = Number(anilistId);
    const ep = Number(testEpisode);
    if (!Number.isInteger(id) || id <= 0) {
      setError('Set AniList ID first.');
      return;
    }
    if (!Number.isInteger(ep) || ep <= 0) {
      setError('Enter a valid episode number.');
      return;
    }
    if (!testProvider) {
      setError('Select a provider to test.');
      return;
    }
    setError('');
    setStreamsLoading(true);
    setStreams([]);
    setTestResults({});
    try {
      const res = await api.getAnivexaWatch({
        provider: testProvider,
        anilistId: id,
        audio: testAudio,
        episode: ep,
      });
      setStreams(res.streams || []);
      if (!(res.streams || []).length) {
        setError(res.error || `No streams from ${testProvider} for ep ${ep} (${testAudio}).`);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch streams');
    } finally {
      setStreamsLoading(false);
    }
  }

  async function handleTestEmbed(url: string) {
    setTestingUrl(url);
    try {
      const res = await api.testAnivexaEmbed(url);
      setTestResults((prev) => ({ ...prev, [url]: res }));
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [url]: { ok: false, error: e.message || 'Test failed' },
      }));
    } finally {
      setTestingUrl(null);
    }
  }

  async function handleTestAllStreams() {
    for (const s of streams) {
      if (s.url) await handleTestEmbed(s.url);
    }
  }

  async function handleImport() {
    const id = Number(anilistId);
    if (!Number.isInteger(id) || id <= 0) {
      setError('Enter a valid AniList ID.');
      return;
    }
    if (!selectedProviders.length && !animeOnly) {
      setError('Select at least one provider, or enable Anime only.');
      return;
    }
    setError('');
    setImporting(true);
    setLastImportMsg('');
    try {
      const payload: Parameters<typeof api.importFromAnivexa>[0] = {
        anilistId: id,
        startEpisode: Number(startEpisode) || 1,
        animeOnly,
        audio,
        providers: selectedProviders,
      };
      if (maxEpisodes.trim()) payload.maxEpisodes = Number(maxEpisodes);
      if (malIdOverride.trim()) payload.malId = Number(malIdOverride);

      const res = await api.importFromAnivexa(payload);
      const msg = res.message || `Imported ${res.imported_episodes} episode(s).`;
      setLastImportMsg(msg);
      showToast('Anivexa import complete', msg);
      onImported?.();
    } catch (e: any) {
      setError(e.message || 'Import failed');
      showToast('Import failed', e.message || 'Unknown error', 'destructive');
    } finally {
      setImporting(false);
    }
  }

  const workingProviders =
    preview &&
    Object.entries(preview).filter(
      ([, s]) => !s.error && (s.sub > 0 || s.dub > 0)
    );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 via-[#0c0c16] to-[#0c0c16] p-5 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wide text-white">
              <Zap className="h-5 w-5 text-indigo-400" />
              Anivexa API Control
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Full control: check providers, test embed links, choose websites, import episodes
            </p>
          </div>
          <button
            onClick={loadInfo}
            disabled={infoLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            {infoLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh connection
          </button>
        </div>

        <div
          className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
            info?.base_url
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          }`}
        >
          <Server className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {info?.base_url ? (
              <>
                <span className="font-semibold">Connected</span> — {info.name || 'Anivexa'} @{' '}
                <code className="text-[11px]">{info.base_url}</code>
                <span className="ml-2 text-emerald-300/80">
                  ({allProviders.length} providers available)
                </span>
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
                on Render and set <code className="text-[11px]">ANIVEXA_API_URL</code> in env.
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lastImportMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{lastImportMsg}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0c0c16] p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">1. Find anime</h3>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Search by title</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. One Piece, Solo Leveling..."
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={searchLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-black/30 p-2">
              {searchResults.map((hit, i) => (
                <button
                  key={`${hit.anilist_id}-${i}`}
                  onClick={() => selectHit(hit)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5"
                >
                  {hit.cover ? (
                    <img src={hit.cover} alt="" className="h-10 w-8 rounded object-cover" />
                  ) : (
                    <div className="flex h-10 w-8 items-center justify-center rounded bg-white/5">
                      <Tv className="h-4 w-4 text-slate-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{hit.title}</div>
                    <div className="text-[11px] text-slate-500">
                      AL {hit.anilist_id || '—'} · MAL {hit.mal_id || '—'}
                      {hit.year ? ` · ${hit.year}` : ''}
                      {hit.format ? ` · ${hit.format}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500">AniList ID *</label>
              <input
                type="number"
                value={anilistId}
                onChange={(e) => setAnilistId(e.target.value)}
                placeholder="Required"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500">MAL ID (override)</label>
              <input
                type="number"
                value={malIdOverride}
                onChange={(e) => setMalIdOverride(e.target.value)}
                placeholder="Auto if possible"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {selectedTitle && (
            <p className="text-xs text-indigo-300">
              Selected: <span className="font-semibold text-white">{selectedTitle}</span>
            </p>
          )}
        </div>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0c0c16] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">2. Choose websites (providers)</h3>
            <div className="flex gap-2">
              <button onClick={selectAllProviders} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300">All</button>
              <button onClick={selectNoneProviders} className="text-[11px] font-bold text-slate-500 hover:text-slate-300">None</button>
            </div>
          </div>

          <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
            {allProviders.map((p) => {
              const selected = selectedProviders.includes(p);
              const stats = preview?.[p];
              const hasEps = stats && !stats.error && (stats.sub > 0 || stats.dub > 0);
              const hasErr = stats?.error;
              return (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  className={`rounded-xl border px-2.5 py-2 text-left text-xs transition-all ${
                    selected
                      ? 'border-indigo-500/50 bg-indigo-600/20 text-white'
                      : 'border-white/5 bg-black/30 text-slate-400 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold truncate">{p}</span>
                    {selected && <CheckCircle2 className="h-3 w-3 shrink-0 text-indigo-400" />}
                  </div>
                  {stats && (
                    <div className="mt-0.5 text-[10px]">
                      {hasErr ? (
                        <span className="text-rose-400">error</span>
                      ) : hasEps ? (
                        <span className="text-emerald-400">sub:{stats.sub} dub:{stats.dub}</span>
                      ) : (
                        <span className="text-slate-600">no eps</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handlePreview}
            disabled={previewLoading || !anilistId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tv className="h-4 w-4" />}
            Check which websites have episodes
          </button>

          {preview && (
            <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-xs text-slate-400">
              <div className="mb-1 font-semibold text-slate-200">
                Preview · AL {anilistId}
                {previewMalId ? ` · MAL ${previewMalId}` : ''}
              </div>
              {workingProviders && workingProviders.length > 0 ? (
                <p className="text-emerald-400">
                  {workingProviders.length} provider(s) with episodes:{' '}
                  {workingProviders.map(([p]) => p).join(', ')}
                </p>
              ) : (
                <p className="text-amber-400">
                  No providers returned episodes for selected list. Try more providers or another ID.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0c0c16] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-300">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          3. Test embed links (which website works)
        </h3>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Provider</label>
            <select
              value={testProvider}
              onChange={(e) => setTestProvider(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              {(selectedProviders.length ? selectedProviders : allProviders).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Episode</label>
            <input
              type="number"
              min={1}
              value={testEpisode}
              onChange={(e) => setTestEpisode(e.target.value)}
              className="w-20 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Audio</label>
            <select
              value={testAudio}
              onChange={(e) => setTestAudio(e.target.value as 'sub' | 'dub')}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="sub">SUB</option>
              <option value="dub">DUB</option>
            </select>
          </div>
          <button
            onClick={handleFetchStreams}
            disabled={streamsLoading || !anilistId}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {streamsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Fetch streams
          </button>
          {streams.length > 0 && (
            <button
              onClick={handleTestAllStreams}
              disabled={!!testingUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-4 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              Test all embeds
            </button>
          )}
        </div>

        {streams.length > 0 && (
          <div className="mt-4 space-y-2">
            {streams.map((s, idx) => {
              const tr = testResults[s.url];
              return (
                <div
                  key={`${s.url}-${idx}`}
                  className="flex flex-col gap-2 rounded-xl border border-white/5 bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-bold text-white">{s.server || s.type || 'stream'}</span>
                      <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-indigo-300">{(s.type || 'unknown').toUpperCase()}</span>
                      {s.priority != null && <span className="text-slate-500">prio {s.priority}</span>}
                      {tr && (
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${
                          tr.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {tr.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {tr.ok
                            ? `OK ${tr.status || ''}${tr.latencyMs != null ? ` · ${tr.latencyMs}ms` : ''}`
                            : tr.error || `Fail ${tr.status || ''}`}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500" title={s.url}>{s.url}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleTestEmbed(s.url)}
                      disabled={testingUrl === s.url}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                    >
                      {testingUrl === s.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                      Test
                    </button>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/10"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0c0c16] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-300">
          <Download className="h-4 w-4 text-indigo-400" />
          4. Import episodes into Supabase
        </h3>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Start ep</label>
            <input type="number" min={1} value={startEpisode} onChange={(e) => setStartEpisode(e.target.value)}
              className="w-20 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Max eps (empty = all)</label>
            <input type="number" min={1} value={maxEpisodes} onChange={(e) => setMaxEpisodes(e.target.value)} placeholder="All"
              className="w-28 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Audio</label>
            <select value={audio} onChange={(e) => setAudio(e.target.value as 'sub' | 'dub' | 'both')}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
              <option value="both">SUB + DUB</option>
              <option value="sub">SUB only</option>
              <option value="dub">DUB only</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-xs text-slate-300">
            <input type="checkbox" checked={animeOnly} onChange={(e) => setAnimeOnly(e.target.checked)} className="rounded border-white/20" />
            Anime metadata only (no episodes)
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleImport}
            disabled={importing || !anilistId}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Import from selected websites
          </button>
          <p className="text-[11px] text-slate-500">
            Uses: {selectedProviders.length ? selectedProviders.join(', ') : '(none)'}
          </p>
        </div>
      </div>
    </div>
  );
}
