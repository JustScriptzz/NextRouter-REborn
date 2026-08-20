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
    return <div className="py-10 text-center text-zinc-500">Loading&hellip;</div>;
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-2xl font-bold text-zinc-100">API Keys</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Keys are used with the <code className="text-zinc-300">/api/v1</code> endpoints via the{' '}
        <code className="text-zinc-300">Authorization: Bearer</code> header.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-6 flex gap-2">
        <input
          type="text"
          required
          maxLength={40}
          placeholder="Key name (e.g. production)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {creating ? 'Creating&hellip;' : '+ New key'}
        </button>
      </form>

      {newKey && (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="text-sm font-medium text-emerald-300">Your new API key</p>
          <p className="mt-2 break-all font-mono text-sm text-zinc-100">{newKey}</p>
          <p className="mt-2 text-xs text-emerald-400/80">
            Copy it now — for security, it will never be shown again.
          </p>
        </div>
      )}

      <section className="mt-8 space-y-3">
        {keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
            No keys yet. Create one above to start calling the API.
          </div>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-100">{k.name}</span>
                  <span className="font-mono text-xs text-zinc-500">
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
              <button
                type="button"
                onClick={() => handleDelete(k.id)}
                className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition hover:border-red-500/50"
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