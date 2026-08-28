'use client';

import { useEffect, useMemo, useState } from 'react';
import ModelCard, { type CatalogModelDTO, type ModelStatusLite } from '@/components/ModelCard';

const KIND_ORDER = ['text', 'image', 'tts', 'stt', 'embedding', 'video'];

const KIND_LABELS: Record<string, string> = {
  text: 'Text',
  image: 'Image',
  tts: 'Speech',
  stt: 'Transcribe',
  embedding: 'Embedding',
  video: 'Video',
};

export default function ModelsExplorer({ models }: { models: CatalogModelDTO[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [statusMap, setStatusMap] = useState<Record<string, ModelStatusLite>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const map: Record<string, ModelStatusLite> = {};
        for (const m of data.models ?? []) {
          map[m.id] = {
            avail: m.avail,
            avgLatencyMs: m.avgLatencyMs,
            tokPerSec: m.tokPerSec,
            last: m.last ?? [],
            updatedAt: m.updatedAt,
          };
        }
        setStatusMap(map);
      } catch {
        /* keep previous */
      }
    }
    load();
    const t = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    map.set('all', models.length);
    for (const m of models) {
      map.set(m.type, (map.get(m.type) ?? 0) + 1);
    }
    return map;
  }, [models]);

  const kinds = useMemo(
    () => KIND_ORDER.filter((k) => (counts.get(k) ?? 0) > 0),
    [counts],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => {
      if (filter !== 'all' && m.type !== filter) return false;
      if (!q) return true;
      return m.id.toLowerCase().includes(q) || (m.title ?? '').toLowerCase().includes(q);
    });
  }, [models, query, filter]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          >
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models..."
            className="input-dark pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg p-1" style={{ border: '0.5px solid #2d2d2d', background: '#0a0a0a' }}>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              filter === 'all' ? 'bg-[#1D1D1F] text-white' : 'text-zinc-400 hover:text-white'
            }`}
            style={filter === 'all' ? { border: '0.5px solid #2d2d2d' } : { border: '0.5px solid transparent' }}
          >
            All
            <span className="ml-1.5 text-xs text-zinc-500">{counts.get('all')}</span>
          </button>
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setFilter(kind)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                filter === kind ? 'bg-[#1D1D1F] text-white' : 'text-zinc-400 hover:text-white'
              }`}
              style={filter === kind ? { border: '0.5px solid #2d2d2d' } : { border: '0.5px solid transparent' }}
            >
              {KIND_LABELS[kind] ?? kind}
              <span className="ml-1.5 text-xs text-zinc-500">{counts.get(kind)}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card mt-8 p-12 text-center">
          <p className="text-sm text-zinc-400">No models match your search.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
            className="mt-3 border-0 bg-transparent text-sm font-medium text-zinc-400 hover:text-white"
            style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m, i) => (
            <div key={m.id} className="anim-fade-up" style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}>
              <ModelCard model={m} status={statusMap[m.id]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
