'use client';

import { useEffect, useState } from 'react';

export default function CodeBlock({
  code,
  label,
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = code;
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

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950/90 shadow-inner">
      {label && (
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
            {label}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className={`absolute right-3 z-10 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition ${
          label ? 'top-11' : 'top-3'
        } ${
          copied
            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
            : 'border-zinc-700 bg-zinc-900/90 text-zinc-400 opacity-0 hover:border-zinc-500 hover:text-white group-hover:opacity-100'
        }`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-zinc-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}
