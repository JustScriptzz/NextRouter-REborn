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

import { apiErrorMessage } from '@/lib/api-error';

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
      setError(apiErrorMessage(data, 'Failed to delete model'));
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400" />
        <p className="mt-4 text-sm text-zinc-500">Loading your models...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-10">
      <div className="anim-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">My Models</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          Add your own endpoints. Your models are exposed as{' '}
          <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-violet-300">
            {username ? `${username}/` : '{username}/'}model-name
          </code>
          .
        </p>
      </div>

      {error && (
        <div className="anim-fade-in mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-300">
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

      <section className="anim-fade-up delay-2 mt-10">
        <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold text-zinc-100">
          Your models
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-xs font-medium text-zinc-400">
            {models.length}/100
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        </h2>
        {models.length === 0 ? (
          <div className="card border-dashed p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-zinc-500" aria-hidden>
                <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 3v5M11.5 5.5h5M6 11v6M3.5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-300">No custom models yet</p>
            <p className="mt-1 text-sm text-zinc-500">Add your first one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((m, i) => (
              <div
                key={m.modelId}
                className="card anim-fade-up flex flex-col p-5"
                style={{ animationDelay: `${Math.min(i * 50, 250)}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 font-mono text-xs font-bold uppercase text-violet-300">
                      {m.modelId.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-mono text-sm font-semibold text-zinc-100" title={m.modelId}>
                        {m.modelId}
                      </h3>
                      <p className="truncate text-xs text-zinc-500">{m.title}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      m.visibility === 'public'
                        ? 'border-violet-500/25 bg-violet-500/15 text-violet-300'
                        : 'border-white/10 bg-white/5 text-zinc-400'
                    }`}
                  >
                    {m.visibility}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.acceptedInputs.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <dl className="mt-4 space-y-1.5 text-xs text-zinc-500">
                  <div className="flex justify-between gap-3">
                    <dt>Endpoint</dt>
                    <dd className="max-w-[60%] truncate font-mono text-zinc-400">{m.endpointUrl}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Provider model</dt>
                    <dd className="max-w-[60%] truncate font-mono text-zinc-400">{m.providerModelId}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Fallback</dt>
                    <dd className="font-mono text-zinc-400">{m.fallbackModelId}</dd>
                  </div>
                  {m.rpm && (
                    <div className="flex justify-between gap-3">
                      <dt>RPM</dt>
                      <dd className="font-mono text-zinc-400">{m.rpm}</dd>
                    </div>
                  )}
                  {m.description && (
                    <div className="pt-1 leading-relaxed text-zinc-400">{m.description}</div>
                  )}
                </dl>
                <div className="mt-auto flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditing(editing === m.modelId ? null : m.modelId)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      editing === m.modelId
                        ? 'border-violet-500/50 bg-violet-500/10 text-violet-200'
                        : 'border-zinc-700/80 text-zinc-300 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    {editing === m.modelId ? 'Close' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.modelId)}
                    className="flex-1 rounded-lg border border-zinc-700/80 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:border-red-500/50 hover:bg-red-500/10"
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
  { value: 'text', label: 'Text', type: 'text' },
  { value: 'image', label: 'Image', type: 'image' },
  { value: 'tts', label: 'Text-to-speech', type: 'tts' },
  { value: 'stt', label: 'Speech-to-text', type: 'stt' },
  { value: 'video', label: 'Video', type: 'video' },
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
        setTestMessage(apiErrorMessage(data, 'Test failed'));
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
        onError(apiErrorMessage(data, 'Failed to fetch models'));
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
        onError(apiErrorMessage(data, 'Failed to add model'));
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
    <div className="anim-fade-up delay-1 mt-6">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-primary">
        {open ? (
          'Cancel'
        ) : (
          <>
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Add model
          </>
        )}
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="card anim-scale-in mt-4 space-y-6 p-6 sm:p-7"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Accepted inputs</label>
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
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-violet-500/60 bg-violet-500/15 text-violet-200 shadow-inner'
                        : 'border-zinc-700/80 text-zinc-400 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Model ID</label>
              <div className="flex items-center gap-1 rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3 py-0.5 transition focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-500/10">
                <span className="font-mono text-sm text-zinc-600">{username}/</span>
                <input
                  type="text"
                  required
                  pattern="[a-zA-Z0-9_-]{1,60}"
                  value={form.modelName}
                  onChange={(e) => set('modelName', e.target.value)}
                  placeholder="my-model"
                  className="w-full bg-transparent py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-600">
                Others call it{' '}
                <span className="font-mono text-zinc-500">
                  {username}/{form.modelName || 'my-model'}
                </span>
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Title</label>
              <input
                type="text"
                required
                maxLength={60}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="My awesome model"
                className="input-dark"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Description <span className="text-zinc-600">(optional)</span>
              </label>
              <input
                type="text"
                maxLength={200}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="What does it do?"
                className="input-dark"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => set('visibility', e.target.value as 'public' | 'private')}
                className="input-dark"
              >
                <option value="private">Private (only you)</option>
                <option value="public">Public (everyone)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Per-user RPM <span className="text-zinc-600">(optional)</span>
              </label>
              <input
                type="number"
                min={1}
                max={600}
                value={form.rpm}
                onChange={(e) => set('rpm', e.target.value)}
                placeholder="60"
                className="input-dark"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Endpoint URL</label>
              <input
                type="url"
                required
                value={form.endpointUrl}
                onChange={(e) => set('endpointUrl', e.target.value)}
                placeholder="https://provider.example.com/v1"
                className="input-dark font-mono text-xs"
              />
            </div>
          </div>

          <div className="border-t border-white/5 pt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Provider model ID
                </label>
                <input
                  type="text"
                  required
                  value={form.providerModelId}
                  onChange={(e) => set('providerModelId', e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="input-dark font-mono text-xs"
                />
                {fetchedModels.length > 0 && (
                  <select
                    value={form.providerModelId}
                    onChange={(e) => set('providerModelId', e.target.value)}
                    className="input-dark anim-fade-in mt-2 font-mono text-xs"
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
                className="btn-ghost"
              >
                {fetching ? 'Fetching...' : 'Fetch models from endpoint'}
              </button>
            </div>
          </div>

          <div className="border-t border-white/5 pt-5">
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">API bearer token</label>
            <input
              type="password"
              required
              value={form.bearerToken}
              onChange={(e) => set('bearerToken', e.target.value)}
              placeholder="Bearer token used by your endpoint"
              className="input-dark font-mono text-xs"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={testState === 'testing' || !form.endpointUrl || !form.providerModelId || !form.bearerToken}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                testState === 'ok'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : testState === 'fail'
                    ? 'border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                    : 'border-violet-500/50 text-violet-300 hover:bg-violet-500/10'
              }`}
            >
              {testState === 'testing' && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {testState === 'testing'
                ? 'Testing...'
                : testState === 'ok'
                  ? 'Test passed'
                  : testState === 'fail'
                    ? 'Test failed - try again'
                    : 'Test connection'}
            </button>
            {testMessage && (
              <p
                className={`anim-fade-in mt-2 text-xs ${testState === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {testMessage}
              </p>
            )}
            {testState !== 'ok' && (
              <p className="mt-1.5 text-xs text-zinc-600">
                You must test the connection successfully before adding the model.
              </p>
            )}
          </div>

          <div className="border-t border-white/5 pt-5">
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Fallback model <span className="text-zinc-600">(shown to everyone)</span>
            </label>
            <select
              value={form.fallbackModelId}
              onChange={(e) => set('fallbackModelId', e.target.value)}
              className="input-dark"
            >
              <option value="">Select a fallback...</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isFallback ? '* ' : ''}
                  {c.id}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-zinc-600">
              Used when your endpoint fails. Must be an available model shown to everyone.
            </p>
          </div>

          <div className="flex justify-end border-t border-white/5 pt-5">
            <button type="submit" disabled={saving} className="btn-primary min-w-[140px]">
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Adding...
                </span>
              ) : (
                'Add model'
              )}
            </button>
          </div>
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
        onError(apiErrorMessage(data, 'Failed to update model'));
        return;
      }
      onSaved(data.model);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="anim-scale-in mt-4 space-y-4 rounded-xl border border-violet-500/20 bg-black/30 p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">Title</label>
        <input
          type="text"
          required
          maxLength={60}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="input-dark"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">Description</label>
        <input
          type="text"
          maxLength={200}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input-dark"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Visibility</label>
          <select
            value={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value as 'public' | 'private' })}
            className="input-dark"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Per-user RPM</label>
          <input
            type="number"
            min={1}
            max={600}
            value={form.rpm}
            onChange={(e) => setForm({ ...form, rpm: e.target.value })}
            className="input-dark"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">Fallback model</label>
        <select
          value={form.fallbackModelId}
          onChange={(e) => setForm({ ...form, fallbackModelId: e.target.value })}
          className="input-dark"
        >
          <option value="">None</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.isFallback ? '* ' : ''}
              {c.id}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Saving...
          </span>
        ) : (
          'Save changes'
        )}
      </button>
    </form>
  );
}
