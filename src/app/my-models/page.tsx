'use client';

import { useCallback, useEffect, useState } from 'react';

interface MyModelDTO {
  id: string;
  modelId: string;
  title: string;
  description: string | null;
  visibility: 'public' | 'private';
  rpm: number | null;
  endpointUrl: string;
  providerModelId: string;
  acceptedInputs: Array<'text' | 'image' | 'tts' | 'stt' | 'video'>;
  fallbackModelId: string;
  createdAt: string;
}

interface CatalogModelDTO {
  id: string;
  title: string;
  type: 'text' | 'image' | 'tts' | 'stt' | 'video';
  isFallback: boolean;
}

export default function MyModelsPage() {
  const [username, setUsername] = useState('');
  const [models, setModels] = useState<MyModelDTO[]>([]);
  const [catalog, setCatalog] = useState<CatalogModelDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, modelsRes, catalogRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/my-models'),
        fetch('/api/models'),
      ]);
      const meData = await meRes.json();
      if (!meData?.user) {
        window.location.href = '/login';
        return;
      }
      setUsername(meData.user.username);
      if (modelsRes.ok) {
        setModels((await modelsRes.json()).models ?? []);
      }
      if (catalogRes.ok) {
        setCatalog((await catalogRes.json()).models ?? []);
      }
    } catch {
      setError('Failed to load page data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!window.confirm(`Delete model ${id}? This cannot be undone.`)) return;
    const res = await fetch(`/api/my-models/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      setModels((prev) => prev.filter((m) => m.modelId !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? 'Failed to delete model');
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-zinc-500">Loading&hellip;</div>;
  }

  return (
    <div className="mx-auto max-w-5xl py-10">
      <h1 className="text-2xl font-bold text-zinc-100">My Models</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Add your own endpoints. Your models are exposed as{' '}
        <code className="text-zinc-300">{username ? `${username}/` : '{username}/'}'model-name'</code>.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <AddModelForm
        username={username}
        catalog={catalog}
        onCreated={(m) => {
          setModels((prev) => [m, ...prev]);
          setError('');
        }}
        onError={(msg) => setError(msg)}
      />

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">
          Your models <span className="text-sm text-zinc-500">({models.length}/100)</span>
        </h2>
        {models.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
            No custom models yet. Add your first one above.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((m) => (
              <div
                key={m.modelId}
                className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-mono text-sm font-semibold text-zinc-100">
                      {m.modelId}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">{m.title}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      m.visibility === 'public'
                        ? 'bg-violet-500/15 text-violet-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {m.visibility}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.acceptedInputs.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <dl className="mt-4 space-y-1 text-xs text-zinc-500">
                  <div className="flex justify-between">
                    <dt>Endpoint</dt>
                    <dd className="max-w-[60%] truncate font-mono text-zinc-400">{m.endpointUrl}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Provider model</dt>
                    <dd className="max-w-[60%] truncate font-mono text-zinc-400">{m.providerModelId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Fallback</dt>
                    <dd className="font-mono text-zinc-400">{m.fallbackModelId}</dd>
                  </div>
                  {m.rpm && (
                    <div className="flex justify-between">
                      <dt>RPM</dt>
                      <dd className="text-zinc-400">{m.rpm}</dd>
                    </div>
                  )}
                  {m.description && (
                    <div className="pt-1 text-zinc-400">{m.description}</div>
                  )}
                </dl>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(editing === m.modelId ? null : m.modelId)}
                    className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    {editing === m.modelId ? 'Close' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.modelId)}
                    className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition hover:border-red-500/50"
                  >
                    Delete
                  </button>
                </div>
                {editing === m.modelId && (
                  <EditModelForm
                    model={m}
                    catalog={catalog}
                    onSaved={(updated) => {
                      setModels((prev) => prev.map((x) => (x.modelId === updated.modelId ? updated : x)));
                      setEditing(null);
                      setError('');
                    }}
                    onError={(msg) => setError(msg)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const INPUT_OPTIONS = [
  { value: 'text', label: '💬 Text', type: 'text' },
  { value: 'image', label: '🎨 Image', type: 'image' },
  { value: 'tts', label: '🔊 Text-to-speech', type: 'tts' },
  { value: 'stt', label: '🎤 Speech-to-text', type: 'stt' },
  { value: 'video', label: '🎬 Video', type: 'video' },
] as const;

function AddModelForm({
  username,
  catalog,
  onCreated,
  onError,
}: {
  username: string;
  catalog: CatalogModelDTO[];
  onCreated: (m: MyModelDTO) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    acceptedInputs: [] as string[],
    modelName: '',
    title: '',
    description: '',
    visibility: 'private' as 'public' | 'private',
    rpm: '',
    endpointUrl: '',
    providerModelId: '',
    bearerToken: '',
    fallbackModelId: catalog.find((c) => c.isFallback)?.id ?? '',
  });
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleTest() {
    setTestState('testing');
    setTestMessage('');
    try {
      const res = await fetch('/api/my-models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptedInputs: form.acceptedInputs,
          endpointUrl: form.endpointUrl,
          providerModelId: form.providerModelId,
          bearerToken: form.bearerToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setTestState('ok');
        setTestMessage(data.message ?? 'Test successful');
      } else {
        setTestState('fail');
        setTestMessage(data?.error ?? 'Test failed');
      }
    } catch {
      setTestState('fail');
      setTestMessage('Test failed');
    }
  }

  async function handleFetchModels() {
    setFetching(true);
    setFetchedModels([]);
    try {
      const res = await fetch('/api/my-models/fetch-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: form.endpointUrl,
          bearerToken: form.bearerToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFetchedModels(data?.models ?? []);
      } else {
        onError(data?.error ?? 'Failed to fetch models');
      }
    } catch {
      onError('Failed to fetch models');
    } finally {
      setFetching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.acceptedInputs.length === 0) {
      onError('Select at least one accepted input type');
      return;
    }
    if (!form.fallbackModelId) {
      onError('Choose a fallback model');
      return;
    }
    if (testState !== 'ok') {
      onError('You must test the endpoint successfully before adding the model');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/my-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          rpm: form.rpm === '' ? null : Number(form.rpm),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data?.error ?? 'Failed to add model');
        return;
      }
      onCreated(data.model);
      setOpen(false);
      setForm({
        acceptedInputs: [],
        modelName: '',
        title: '',
        description: '',
        visibility: 'private',
        rpm: '',
        endpointUrl: '',
        providerModelId: '',
        bearerToken: '',
        fallbackModelId: catalog.find((c) => c.isFallback)?.id ?? '',
      });
      setTestState('idle');
      setTestMessage('');
      setFetchedModels([]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
      >
        {open ? 'Cancel' : '+ Add model'}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Accepted inputs</label>
            <div className="flex flex-wrap gap-2">
              {INPUT_OPTIONS.map((opt) => {
                const active = form.acceptedInputs.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      set(
                        'acceptedInputs',
                        active
                          ? form.acceptedInputs.filter((v) => v !== opt.value)
                          : [...form.acceptedInputs, opt.value]
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Model ID</label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-zinc-600">{username}/</span>
                <input
                  type="text"
                  required
                  pattern="[a-zA-Z0-9_-]{1,60}"
                  value={form.modelName}
                  onChange={(e) => set('modelName', e.target.value)}
                  placeholder="my-model"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-600">
                Others call it <span className="font-mono">{username}/{form.modelName || 'my-model'}</span>
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Title</label>
              <input
                type="text"
                required
                maxLength={60}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="My awesome model"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Description (optional)</label>
              <input
                type="text"
                maxLength={200}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => set('visibility', e.target.value as 'public' | 'private')}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
              >
                <option value="private">Private (only you)</option>
                <option value="public">Public (everyone)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Per-user RPM (optional)</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={form.rpm}
                onChange={(e) => set('rpm', e.target.value)}
                placeholder="60"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Endpoint URL</label>
              <input
                type="url"
                required
                value={form.endpointUrl}
                onChange={(e) => set('endpointUrl', e.target.value)}
                placeholder="https://provider.example.com/v1"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-violet-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-sm text-zinc-400">Provider model ID</label>
              <input
                type="text"
                required
                value={form.providerModelId}
                onChange={(e) => set('providerModelId', e.target.value)}
                placeholder="gpt-4o-mini"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-violet-500"
              />
              {fetchedModels.length > 0 && (
                <select
                  value={form.providerModelId}
                  onChange={(e) => set('providerModelId', e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                >
                  {fetchedModels.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={fetching || !form.endpointUrl}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
            >
              {fetching ? 'Fetching&hellip;' : 'Fetch models from endpoint'}
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">API bearer token</label>
            <input
              type="password"
              required
              value={form.bearerToken}
              onChange={(e) => set('bearerToken', e.target.value)}
              placeholder="Bearer token used by your endpoint"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-violet-500"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={testState === 'testing' || !form.endpointUrl || !form.providerModelId || !form.bearerToken}
              className="mt-2 rounded-lg border border-violet-500/50 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-50"
            >
              {testState === 'testing'
                ? 'Testing&hellip;'
                : testState === 'ok'
                  ? '✓ Test passed'
                  : testState === 'fail'
                    ? '✗ Test failed — test again'
                    : 'Test connection'}
            </button>
            {testMessage && (
              <p className={`mt-2 text-xs ${testState === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                {testMessage}
              </p>
            )}
            {testState !== 'ok' && (
              <p className="mt-1 text-xs text-zinc-600">
                You must test the connection successfully before adding the model.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">Fallback model (shown to everyone)</label>
            <select
              value={form.fallbackModelId}
              onChange={(e) => set('fallbackModelId', e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
            >
              <option value="">Select a fallback&hellip;</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isFallback ? '★ ' : ''}
                  {c.id}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-600">
              Used when your endpoint fails. Must be an available model shown to everyone.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
          >
            {saving ? 'Adding&hellip;' : 'Add model'}
          </button>
        </form>
      )}
    </div>
  );
}

function EditModelForm({
  model,
  catalog,
  onSaved,
  onError,
}: {
  model: MyModelDTO;
  catalog: CatalogModelDTO[];
  onSaved: (m: MyModelDTO) => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    modelName: model.modelId.includes('/') ? model.modelId.split('/')[1] ?? '' : model.modelId,
    title: model.title,
    description: model.description ?? '',
    visibility: model.visibility,
    rpm: model.rpm ? String(model.rpm) : '',
    endpointUrl: model.endpointUrl,
    providerModelId: model.providerModelId,
    acceptedInputs: [...model.acceptedInputs],
    fallbackModelId: model.fallbackModelId,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/my-models/${encodeURIComponent(model.modelId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          rpm: form.rpm === '' ? null : Number(form.rpm),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data?.error ?? 'Failed to update model');
        return;
      }
      onSaved(data.model);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-500">Title</label>
        <input
          type="text"
          required
          maxLength={60}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-500">Description</label>
        <input
          type="text"
          maxLength={200}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Visibility</label>
          <select
            value={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value as 'public' | 'private' })}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Per-user RPM</label>
          <input
            type="number"
            min={1}
            max={10000}
            value={form.rpm}
            onChange={(e) => setForm({ ...form, rpm: e.target.value })}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-500">Fallback model</label>
        <select
          value={form.fallbackModelId}
          onChange={(e) => setForm({ ...form, fallbackModelId: e.target.value })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
        >
          <option value="">None</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.isFallback ? '★ ' : ''}
              {c.id}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {saving ? 'Saving&hellip;' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}