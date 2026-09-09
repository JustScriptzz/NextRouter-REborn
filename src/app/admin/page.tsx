'use client';

export const runtime = 'edge';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<unknown>(null);
  const [models, setModels] = useState<{ id: string; title?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statusRes, modelsRes] = await Promise.all([
          fetch('/api/status')
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('/api/models')
            .then((r) => (r.ok ? r.json() : { models: [] }))
            .catch(() => ({ models: [] })),
        ]);
        setStatus(statusRes);
        setModels(modelsRes?.models || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Admin panel</h1>
          <p className="text-sm text-zinc-500">NextRouter REborn</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-zinc-700/80 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-500/50 hover:bg-red-500/10"
        >
          Logout
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 text-lg font-medium text-zinc-100">System status</h2>
            <pre className="max-h-64 overflow-auto text-xs text-zinc-400">
              {JSON.stringify(status, null, 2)}
            </pre>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 text-lg font-medium text-zinc-100">
              Models ({models.length})
            </h2>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm text-zinc-300">
              {models.map((m) => (
                <li key={m.id}>{m.title || m.id}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
