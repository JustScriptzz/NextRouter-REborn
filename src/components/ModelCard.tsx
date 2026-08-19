'use client';

import { useEffect, useState } from 'react';

export interface CatalogModelDTO {
  id: string;
  title: string;
  type: 'text' | 'image' | 'tts' | 'stt' | 'video';
  isFallback: boolean;
}

interface ModelCardProps {
  model: CatalogModelDTO;
}

export default function ModelCard({ model }: ModelCardProps) {
  const [copied, setCopied] = useState(false);

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

  const typeLabel = { text: '📝', image: '🎨', tts: '🔊', stt: '🎤', video: '🎬' }[model.type];

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {model.isFallback && (
            <span className="mb-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              Fallback
            </span>
          )}
          <h2 className="truncate font-mono text-sm font-semibold text-zinc-100">{model.id}</h2>
        </div>
        <span className="shrink-0 text-xl" aria-label={model.type}>
          {typeLabel}
        </span>
      </div>
      {model.title && <p className="mt-1 text-sm text-zinc-500">{model.title}</p>}
      <button
        type="button"
        onClick={copyId}
        className="mt-4 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
      >
        {copied ? 'Copied!' : 'Copy model ID'}
      </button>
    </div>
  );
}