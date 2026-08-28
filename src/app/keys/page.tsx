'use client';

import { useCallback, useEffect, useState } from 'react';

interface ApiKeyDTO {
  id: string;
  name: string;
  masked: string;
  createdAt: string;
  lastUsedAt: string | null;
}

import { apiErrorMessage } from '@/lib/api-error';

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKeyDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/keys');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) window.location.href = '/login';
      setError(apiErrorMessage(data, 'Failed to load keys'));
      setLoading(false);
      return;
    }
    const data = await res.json();
    setKeys(data?.keys ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyNewKey() {
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch {
      /* ignore */
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    setNewKey('');
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(data, 'Failed to create key'));
        return;
      }
      setNewKey(data.key);
      setName('');
      load();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this API key? It will stop working immediately.')) return;
    setError('');
    const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(apiErrorMessage(data, 'Failed to delete key'));
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading keys" />;
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="anim-fade-up flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">API Keys</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
            Keys authenticate calls to the{' '}
            <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>
              /api/v1
            </code>{' '}
            endpoints via the{' '}
            <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>
              Authorization: Bearer
            </code>{' '}
            header.
          </p>
        </div>
        <span className="hidden shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-zinc-400 sm:inline-flex">
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 text-white" aria-hidden>
            <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M9.5 9.5L17 17M14 14l2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {keys.length} active
        </span>
      </div>

      {error && (
        <div className="anim-fade-in mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="anim-fade-up delay-1 card mt-6 flex flex-col gap-2 p-4 sm:flex-row">
        <input
          type="text"
          required
          maxLength={40}
          placeholder="Key name (e.g. production)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-dark flex-1"
        />
        <button type="submit" disabled={creating} className="btn-primary shrink-0">
          {creating ? (
            'Creating...'
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              New key
            </>
          )}
        </button>
      </form>

      {newKey && (
        <div className="anim-scale-in mt-4 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-transparent p-5">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-emerald-400" aria-hidden>
              <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-semibold text-emerald-300">Your new API key</p>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 font-mono text-sm text-zinc-100">
              {newKey}
            </code>
            <button
              type="button"
              onClick={copyNewKey}
              className={`btn-ghost shrink-0 ${copied ? 'border-emerald-500/50 text-emerald-300' : ''}`}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2.5 text-xs text-emerald-400/80">
            Copy it now — for security, it will never be shown again.
          </p>
        </div>
      )}

      <section className="mt-8 space-y-3">
        {keys.length === 0 ? (
          <div className="card border-dashed p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-zinc-500" aria-hidden>
                <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M9.5 9.5L17 17M14 14l2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-300">No keys yet</p>
            <p className="mt-1 text-sm text-zinc-500">Create one above to start calling the API.</p>
          </div>
        ) : (
          keys.map((k, i) => (
            <div
              key={k.id}
              className="card card-hover anim-fade-up flex items-center justify-between gap-4 p-4"
              style={{ animationDelay: `${Math.min(i * 50, 250)}ms` }}
            >
              <div className="flex min-w-0 items-center gap-3.5">
<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2d2d2d] bg-[#1D1D1F]">
                  <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px] text-white" aria-hidden>
                    <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9.5 9.5L17 17M14 14l2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-100">{k.name}</span>
                    <span className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">
                      {k.masked}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt
                      ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}`
                      : ' · never used'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(k.id)}
                className="shrink-0 rounded-lg border border-zinc-700/80 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      <p className="mt-4 text-sm text-zinc-500">{label}...</p>
    </div>
  );
}
