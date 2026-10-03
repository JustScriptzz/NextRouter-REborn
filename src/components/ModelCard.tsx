'use client';

import { useEffect, useState, type ReactNode } from 'react';

export interface CatalogModelDTO {
  id: string;
  title: string;
  type: 'text' | 'image' | 'tts' | 'stt' | 'video' | 'embedding';
  isFallback: boolean;
}

export interface ModelStatusLite {
  avail: number | null;
  avgLatencyMs: number | null;
  tokPerSec: number | null;
  last: boolean[];
  updatedAt: number | null;
}

interface ModelCardProps {
  model: CatalogModelDTO;
  status?: ModelStatusLite;
}

function statusColor(avail: number | null): 'green' | 'amber' | 'red' | 'gray' {
  if (avail === null) return 'gray';
  if (avail >= 0.999) return 'green';
  if (avail >= 0.5) return 'amber';
  return 'red';
}

const DOT_CLASS: Record<string, string> = {
  green: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
  amber: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]',
  red: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]',
  gray: 'bg-zinc-600',
};

function StatusStrip({ status }: { status: ModelStatusLite }) {
  const color = statusColor(status.avail);
  const lat = status.avgLatencyMs !== null ? (status.avgLatencyMs / 1000).toFixed(1) : null;
  const slots: Array<boolean | null> = [];
  for (let i = 0; i < 20; i++) {
    const fromEnd = (status.last?.length ?? 0) - 20 + i;
    slots.push(fromEnd >= 0 ? status.last[fromEnd] : null);
  }
  return (
    <div className="relative mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-tight text-zinc-500">
        <span>
          Availability{' '}
          <span
            className={`font-bold ${
              color === 'green'
                ? 'text-emerald-400'
                : color === 'amber'
                  ? 'text-amber-400'
                  : color === 'red'
                    ? 'text-red-400'
                    : 'text-zinc-500'
            }`}
          >
            {status.avail === null ? '—' : `${(status.avail * 100).toFixed(1)}%`}
          </span>
        </span>
        <span>
          Latency <span className="font-semibold text-zinc-300">{lat ? `${lat}s` : '—'}</span>
        </span>
        <span>
          Speed{' '}
          <span className="font-semibold text-zinc-300">
            {status.tokPerSec !== null ? `${status.tokPerSec} tok/s` : '—'}
          </span>
        </span>
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {slots.map((v, i) => (
          <div
            key={i}
            className={`h-2.5 w-1.5 rounded-[2px] ${
              v === null ? 'bg-white/10' : v ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

const TYPE_STYLES: Record<
  CatalogModelDTO['type'],
  { label: string; badge: string; ring: string; icon: ReactNode }
> = {
  text: {
    label: 'Text',
    badge: 'bg-[#1D1D1F] text-zinc-300 border-[#2d2d2d]',
    ring: 'from-white/[0.04] via-transparent to-transparent',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M4 5h12M4 10h9M4 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  image: {
    label: 'Image',
    badge: 'bg-[#1D1D1F] text-zinc-300 border-[#2d2d2d]',
    ring: 'from-white/[0.04] via-transparent to-transparent',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="7.5" cy="8.5" r="1.4" fill="currentColor" />
        <path d="M4 14l4-4 3 3 2.5-2.5L17 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  tts: {
    label: 'Speech',
    badge: 'bg-[#1D1D1F] text-zinc-300 border-[#2d2d2d]',
    ring: 'from-white/[0.04] via-transparent to-transparent',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M4 8v4h3l4 3V5L7 8H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M14 7a4 4 0 010 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  stt: {
    label: 'Transcribe',
    badge: 'bg-[#1D1D1F] text-zinc-300 border-[#2d2d2d]',
    ring: 'from-white/[0.04] via-transparent to-transparent',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <rect x="7.5" y="3" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.5 9.5a5.5 5.5 0 0011 0M10 15v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  video: {
    label: 'Video',
    badge: 'bg-[#1D1D1F] text-zinc-300 border-[#2d2d2d]',
    ring: 'from-white/[0.04] via-transparent to-transparent',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <rect x="3" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13 9l4-2.5v7L13 11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  embedding: {
    label: 'Embedding',
    badge: 'bg-[#1D1D1F] text-zinc-300 border-[#2d2d2d]',
    ring: 'from-white/[0.04] via-transparent to-transparent',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="4.5" cy="5" r="1.4" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="15.5" cy="5" r="1.4" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="4.5" cy="15" r="1.4" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="15.5" cy="15" r="1.4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 6l2.5 2.5m5.5-2.5L11.5 8.5M6 14l2.5-2.5m5.5 2.5L11.5 11.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
};

export default function ModelCard({ model, status }: ModelCardProps) {
  const [copied, setCopied] = useState(false);
  const color = statusColor(status?.avail ?? null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(model.id);
      setCopied(true);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = model.id;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
      } catch {
        /* ignore */
      }
    }
  }

  const style = TYPE_STYLES[model.type] ?? TYPE_STYLES.text;

  return (
    <div className="card card-hover group relative flex flex-col overflow-hidden p-5">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b opacity-60 ${style.ring}`}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}
            >
              {style.icon}
              {style.label}
            </span>
            {model.isFallback && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: '#ffffff', color: '#000000', border: '0.5px solid #ffffff' }}>
                <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden>
                  <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.7l5.4-.8L10 2z" fill="currentColor" />
                </svg>
                Fallback
              </span>
            )}
          </div>
          <h2 className="mt-2.5 flex items-center gap-2 truncate font-mono text-sm font-semibold text-zinc-100" title={model.id}>
            <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[color]}`} />
            <span className="truncate">{model.id}</span>
          </h2>
        </div>
      </div>
      {model.title && (
        <p className="relative mt-1.5 line-clamp-2 text-sm leading-snug text-zinc-500">{model.title}</p>
      )}
      {status && status.updatedAt !== null && <StatusStrip status={status} />}
      <button
        type="button"
        onClick={copyId}
        className={`relative mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
          copied
            ? 'text-white'
            : 'text-zinc-400 hover:text-white'
        }`}
        style={copied ? { border: '0.5px solid #ffffff', background: '#ffffff', color: '#000000' } : { border: '0.5px solid #2d2d2d', background: '#0a0a0a' }}
      >
        {copied ? (
          <>
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <rect x="7" y="7" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M13 7V5a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 5v6.5A1.5 1.5 0 005 13h2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Copy model ID
          </>
        )}
      </button>
    </div>
  );
}
