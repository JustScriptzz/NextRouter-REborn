'use client';

export const runtime = 'edge';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type ModelKind = 'text' | 'image' | 'tts' | 'stt' | 'video' | 'embedding';
const KINDS: ModelKind[] = ['text', 'image', 'tts', 'stt', 'video', 'embedding'];

interface AdminModel {
  id: string;
  type: ModelKind;
  title: string;
  providers: string[];
  hidden: boolean;
  manual?: boolean;
  avail: number | null;
}

interface BuiltinProvider {
  name: string;
  disabled: boolean;
  configured: boolean;
}

interface CustomProvider {
  name: string;
  baseUrl: string;
}

interface ConfigResponse {
  kvConfigured: boolean;
  models: AdminModel[];
  builtinProviders: BuiltinProvider[];
  customProviders: CustomProvider[];
}

type Tab = 'models' | 'providers';

function Toast({ text, kind }: { text: string; kind: 'ok' | 'err' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg ${
        kind === 'ok'
          ? 'border-emerald-800 bg-emerald-950 text-emerald-300'
          : 'border-red-800 bg-red-950 text-red-300'
      }`}
    >
      {text}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('models');
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ModelKind | 'all'>('all');

  // Per-row edit buffers, keyed by model id.
  const [titleEdits, setTitleEdits] = useState<Record<string, string>>({});
  const [idEdits, setIdEdits] = useState<Record<string, string>>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);

  const [newProvider, setNewProvider] = useState({ name: '', baseUrl: '', apiKey: '' });
  const [addingProvider, setAddingProvider] = useState(false);
  const [bulkHiding, setBulkHiding] = useState(false);

  function showToast(text: string, kind: 'ok' | 'err') {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config');
      if (res.status === 401) {
        router.push('/login?next=/admin');
        return;
      }
      const json = (await res.json()) as ConfigResponse;
      setData(json);
    } catch {
      showToast('Failed to load admin data', 'err');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const filteredModels = useMemo(() => {
    if (!data) return [];
    return data.models.filter((m) => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (search && !m.id.toLowerCase().includes(search.toLowerCase()) && !m.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [data, search, typeFilter]);

  async function saveTitle(model: AdminModel) {
    const value = (titleEdits[model.id] ?? model.title).trim();
    if (!value || value === model.title) return;
    setSavingRow(model.id + ':title');
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: model.id, action: 'name', value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to rename model', 'err');
        return;
      }
      showToast('Title updated', 'ok');
      await loadConfig();
    } finally {
      setSavingRow(null);
    }
  }

  async function saveId(model: AdminModel) {
    const value = (idEdits[model.id] ?? model.id).trim();
    if (!value || value === model.id) return;
    setSavingRow(model.id + ':id');
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: model.id, action: 'rename', value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to change model id', 'err');
        return;
      }
      showToast('Model id updated', 'ok');
      await loadConfig();
    } finally {
      setSavingRow(null);
    }
  }

  async function changeType(model: AdminModel, type: ModelKind) {
    if (type === model.type) return;
    setSavingRow(model.id + ':type');
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: model.id, action: 'type', value: type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to change model type', 'err');
        return;
      }
      showToast('Type updated', 'ok');
      await loadConfig();
    } finally {
      setSavingRow(null);
    }
  }

  async function toggleHidden(model: AdminModel) {
    setSavingRow(model.id + ':hide');
    try {
      const res = await fetch('/api/admin/models/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: model.id, hidden: !model.hidden }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update visibility', 'err');
        return;
      }
      showToast(model.hidden ? 'Model unhidden' : 'Model hidden', 'ok');
      await loadConfig();
    } finally {
      setSavingRow(null);
    }
  }

  async function disableLowSuccessModels() {
    if (!confirm('Hide every model with under 20% success rate? Models with no data yet are left alone.')) {
      return;
    }
    setBulkHiding(true);
    try {
      const res = await fetch('/api/admin/models/bulk-hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: 0.2 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to hide low-success models', 'err');
        return;
      }
      const result = await res.json();
      showToast(
        result.count > 0 ? `Hid ${result.count} model(s) under 20%` : 'No models under 20% found',
        'ok',
      );
      await loadConfig();
    } finally {
      setBulkHiding(false);
    }
  }

  async function toggleProvider(p: BuiltinProvider) {
    setSavingRow('provider:' + p.name);
    try {
      const res = await fetch('/api/admin/providers/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p.name, disabled: !p.disabled }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to toggle provider', 'err');
        return;
      }
      showToast(p.disabled ? 'Provider enabled' : 'Provider disabled', 'ok');
      await loadConfig();
    } finally {
      setSavingRow(null);
    }
  }

  async function addProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!newProvider.name.trim() || !newProvider.baseUrl.trim()) return;
    setAddingProvider(true);
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProvider),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to add provider', 'err');
        return;
      }
      showToast('Provider added', 'ok');
      setNewProvider({ name: '', baseUrl: '', apiKey: '' });
      await loadConfig();
    } finally {
      setAddingProvider(false);
    }
  }

  async function removeCustomProvider(name: string) {
    setSavingRow('custom-provider:' + name);
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to remove provider', 'err');
        return;
      }
      showToast('Provider removed', 'ok');
      await loadConfig();
    } finally {
      setSavingRow(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
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

      {!loading && data && !data.kvConfigured && (
        <div className="mb-6 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          KV storage isn&apos;t available in this environment - changes here won&apos;t persist.
        </div>
      )}

      <div className="mb-6 flex gap-1 border-b border-zinc-800">
        {(['models', 'providers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? 'border-b-2 border-red-500 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'models' ? 'Models' : 'Providers'}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <p className="text-zinc-500">Loading...</p>
      ) : tab === 'models' ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search by id or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ModelKind | 'all')}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              <option value="all">All types</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">
              {filteredModels.length} / {data.models.length} models
            </span>
            <button
              onClick={disableLowSuccessModels}
              disabled={bulkHiding}
              className="rounded-lg border border-amber-700/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              {bulkHiding ? 'Working...' : 'Disable models under 20%'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Id</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Providers</th>
                  <th className="px-4 py-3">Success</th>
                  <th className="px-4 py-3 text-right">Hidden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredModels.map((m) => (
                  <tr key={m.id} className={m.hidden ? 'opacity-50' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={idEdits[m.id] ?? m.id}
                          onChange={(e) => setIdEdits((s) => ({ ...s, [m.id]: e.target.value }))}
                          className="w-40 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-500"
                        />
                        <button
                          onClick={() => saveId(m)}
                          disabled={savingRow === m.id + ':id' || (idEdits[m.id] ?? m.id) === m.id}
                          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-red-500/50 hover:text-zinc-200 disabled:opacity-30"
                        >
                          {savingRow === m.id + ':id' ? '...' : 'Save'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={titleEdits[m.id] ?? m.title}
                          onChange={(e) => setTitleEdits((s) => ({ ...s, [m.id]: e.target.value }))}
                          className="w-44 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500"
                        />
                        <button
                          onClick={() => saveTitle(m)}
                          disabled={
                            savingRow === m.id + ':title' || (titleEdits[m.id] ?? m.title) === m.title
                          }
                          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-red-500/50 hover:text-zinc-200 disabled:opacity-30"
                        >
                          {savingRow === m.id + ':title' ? '...' : 'Save'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={m.type}
                        onChange={(e) => changeType(m, e.target.value as ModelKind)}
                        disabled={savingRow === m.id + ':type'}
                        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500"
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{m.providers.join(', ')}</td>
                    <td className="px-4 py-3 text-xs">
                      {m.avail === null ? (
                        <span className="text-zinc-600">no data</span>
                      ) : (
                        <span className={m.avail < 0.2 ? 'text-red-400' : 'text-zinc-400'}>
                          {Math.round(m.avail * 100)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleHidden(m)}
                        disabled={savingRow === m.id + ':hide'}
                        className={`rounded-full px-3 py-1 text-xs transition ${
                          m.hidden
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {m.hidden ? 'Hidden' : 'Visible'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredModels.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                      No models match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-lg font-medium text-zinc-100">Built-in providers</h2>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Configured</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.builtinProviders.map((p) => (
                    <tr key={p.name}>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-200">{p.name}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {p.configured ? 'Yes' : 'No base URL/key'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleProvider(p)}
                          disabled={savingRow === 'provider:' + p.name}
                          className={`rounded-full px-3 py-1 text-xs transition ${
                            p.disabled
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          {p.disabled ? 'Disabled' : 'Enabled'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-medium text-zinc-100">Custom providers</h2>
            {data.customProviders.length > 0 && (
              <div className="mb-4 overflow-hidden rounded-xl border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Base URL</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.customProviders.map((p) => (
                      <tr key={p.name}>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-200">{p.name}</td>
                        <td className="px-4 py-3 text-xs text-zinc-400">{p.baseUrl}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeCustomProvider(p.name)}
                            disabled={savingRow === 'custom-provider:' + p.name}
                            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-red-500/50 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form
              onSubmit={addProvider}
              className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-3"
            >
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Name</label>
                <input
                  value={newProvider.name}
                  onChange={(e) => setNewProvider((s) => ({ ...s, name: e.target.value }))}
                  placeholder="my-provider"
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Base URL</label>
                <input
                  value={newProvider.baseUrl}
                  onChange={(e) => setNewProvider((s) => ({ ...s, baseUrl: e.target.value }))}
                  placeholder="https://api.example.com"
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">API key (optional)</label>
                <input
                  value={newProvider.apiKey}
                  onChange={(e) => setNewProvider((s) => ({ ...s, apiKey: e.target.value }))}
                  type="password"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={addingProvider}
                  className="rounded-lg border border-zinc-700/80 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {addingProvider ? 'Adding...' : 'Add provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast text={toast.text} kind={toast.kind} />}
    </main>
  );
}
