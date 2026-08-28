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
    <div className="group relative overflow-hidden" style={{ border: '0.5px solid #2d2d2d', background: '#000000', borderRadius: '12px' }}>
      {label && (
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '0.5px solid #2d2d2d', background: '#0a0a0a' }}>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: '#2d2d2d' }} />
            <span className="h-2 w-2 rounded-full" style={{ background: '#3a3a3a' }} />
            <span className="h-2 w-2 rounded-full" style={{ background: '#555555' }} />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: '#888888', letterSpacing: '0.08em' }}>
            {label}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className={`absolute right-3 z-10 rounded-lg px-2.5 py-1 font-mono text-[11px] transition ${
          label ? 'top-11' : 'top-3'
        } ${copied ? 'text-white' : 'text-zinc-400 opacity-0 hover:text-white group-hover:opacity-100'}`}
        style={copied ? { border: '0.5px solid #ffffff', background: '#ffffff', color: '#000000' } : { border: '0.5px solid #2d2d2d', background: '#1D1D1F' }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed" style={{ color: '#e5e5e5', fontFamily: 'monospace' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
