'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Playground() {
  const pathname = usePathname();
  const router = useRouter();
  const [models, setModels] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/models');
        if (res.ok) {
          const { models: m } = await res.json();
          setModels(m);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function sendChat() {
    if (!selected) return;
    try {
      await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer nr_public_nextrouter_free',
        },
        body: JSON.stringify({
          model: selected.id,
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-500">Error loading models: {error}</p>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-medium mb-4 text-zinc-100">Models</h2>
              <ul className="space-y-2 text-zinc-200">
                {models.map((m) => (
                  <li
                    key={m.id}
                    className={selected?.id === m.id ? 'font-medium text-white' : 'hover:text-zinc-300 cursor-pointer'}
                    onClick={() => setSelected(m)}
                  >
                    {m.title || m.id}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              {selected && (
                <div className="border rounded p-6 bg-gray-900">
                  <h3 className="text-lg font-medium mb-4 text-zinc-100">Preview</h3>
                  <p>Selected model: {selected.title || selected.id}</p>
                  <button
                    onClick={sendChat}
                    className="mt-4 rounded-xl border border-zinc-700/80 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-500/50 hover:bg-red-500/10"
                  >
                    Send test request
                  </button>
                </div>
              )}
            </div>
          </div>
    </main>
  );
}