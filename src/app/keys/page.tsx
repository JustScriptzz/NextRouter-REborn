'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function KeysPage() {
  const [pubKey, setPubKey] = useState('');
  const [rpm, setRpm] = useState(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/public-key')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.key === 'string') setPubKey(d.key);
        if (typeof d?.rpmPerIp === 'number') setRpm(d.rpmPerIp);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(pubKey);
      setCopied(true);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="anim-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">API Keys</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
          No signups, no personal keys. Everyone shares one public key, rate-limited
          per IP. Full examples live on the Docs page.
        </p>
      </div>

      <div className="anim-fade-up delay-1 card mt-6 p-5">
        <p className="text-sm font-semibold text-zinc-100">Public key</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 break-all rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 font-mono text-sm text-zinc-100">
            {pubKey || 'Loading...'}
          </code>
          <button
            type="button"
            onClick={copyKey}
            disabled={!pubKey}
            className={`btn-ghost shrink-0 ${copied ? 'border-emerald-500/50 text-emerald-300' : ''}`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {rpm} requests/min per IP · fixed for everyone · no increases. Use it as{' '}
          <code className="font-mono text-zinc-300">Authorization: Bearer {pubKey ? pubKey.slice(0, 12) + '...' : '...'}</code>.
        </p>
        <Link href="/docs" className="btn-primary mt-4 inline-flex">
          Read the docs
        </Link>
      </div>
    </div>
  );
}
