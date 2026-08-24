'use client';

import { useCallback, useEffect, useState } from 'react';

interface ModelStatus {
  id: string;
  type: string | null;
  providers: string[];
  free: boolean;
  ok: number;
  fail: number;
  avail: number | null;
  avgLatencyMs: number | null;
  tokPerSec: number | null;
  last: boolean[];
  updatedAt: number | null;
}

type Filter = 'all' | 'live' | 'issues';

function statusOf(m: ModelStatus): 'green' | 'amber' | 'red' | 'gray' {
  if (m.avail === null) return 'gray';
  if (m.avail >= 0.999) return 'green';
  if (m.avail >= 0.5) return 'amber';
  return 'red';
}

const DOT: Record<string, string> = {
  green: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  amber: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
  red: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
  gray: 'bg-zinc-600',
};

const BAR: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  gray: 'bg-white/10',
};

function UptimeBars({ m }: { m: ModelStatus }) {
  const slots: Array<boolean | null> = [];
  for (let i = 0; i < 20; i++) {
    const fromEnd = m.last.length - 20 + i;
    slots.push(fromEnd >= 0 ? m.last[fromEnd] : null);
  }
  return (
    <div className="mt-3 flex gap-1">
      {slots.map((v, i) => (
        <div key={i} className={`h-4 w-2.5 rounded-[4px] ${v === null ? BAR.gray : v ? BAR.green : BAR.red}`} />
      ))}
    </div>
  );
}

function ModelCard({ m }: { m: ModelStatus }) {
  const st = statusOf(m);
  const lat = m.avgLatencyMs !== null ? (m.avgLatencyMs / 1000).toFixed(1) : null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117]/90 p-5 shadow-lg shadow-black/30 transition hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${DOT[st]}`} />
          <h3 className="truncate text-lg font-bold text-zinc-50">{m.id}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          {m.type ?? '?'}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-sm text-zinc-400">
        <span>Price</span>
        <span className="rounded-md bg-white/10 px-2.5 py-1 font-bold text-white">$0.00</span>
        <span>/request</span>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-base">
        <span className="text-zinc-400">
          Availability{' '}
          <span className={`font-bold ${st === 'green' ? 'text-emerald-400' : st === 'amber' ? 'text-amber-400' : st === 'red' ? 'text-red-400' : 'text-zinc-500'}`}>
            {m.avail === null ? '—' : `${(m.avail * 100).toFixed(1)}%`}
          </span>
        </span>
        <span className="text-zinc-400">
          Latency <span className="font-bold text-white">{lat ? `${lat}s` : '—'}</span>
        </span>
        <span className="text-zinc-400">
          Speed <span className="font-bold text-white">{m.tokPerSec !== null ? `${m.tokPerSec} tok/s` : '—'}</span>
        </span>
      </div>

      <UptimeBars m={m} />

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {m.providers.slice(0, 3).map((p) => (
            <span key={p} className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">{p}</span>
          ))}
          {m.providers.length === 0 && <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-500">no data</span>}
        </div>
        {m.free && (
          <span className="rounded-full bg-rose-500/15 px-4 py-1.5 text-sm text-rose-300">Free</span>
        )}
      </div>
    </div>
  );
}

export default function StatusBoard() {
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setModels(data.models ?? []);
      setLoaded(true);
    } catch {
      /* keep old data */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const live = models.filter((m) => m.updatedAt !== null);
  const issues = models.filter((m) => m.avail !== null && m.avail < 0.999);

  const filtered = models.filter((m) => {
    if (filter === 'live' && m.updatedAt === null) return false;
    if (filter === 'issues' && !(m.avail !== null && m.avail < 0.999)) return false;
    if (query && !m.id.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
              </span>
              <h1 className="text-2xl font-bold">Live model status</h1>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Real-time availability, latency and speed measured on actual NextRouter traffic.
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div>{live.length} models with live data · refreshes every 10s</div>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {(['all', 'live', 'issues'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === f ? 'bg-white/15 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'all' ? `All (${models.length})` : f === 'live' ? `Live (${live.length})` : `Issues (${issues.length})`}
            </button>
          ))}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models..."
            className="ml-auto w-56 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
          />
        </div>

        {!loaded ? (
          <div className="py-24 text-center text-zinc-500">Loading status…</div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center text-zinc-500">No models match.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((m) => (
              <ModelCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
