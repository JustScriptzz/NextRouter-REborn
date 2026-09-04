'use client';

import { useEffect, useMemo, useState } from 'react';

type CatalogEntry = { id: string; type: string; provider: string; description?: string };

export default function AdminModels({ catalog }: { catalog: CatalogEntry[] }) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [rules, setRules] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editId, setEditId] = useState('');
  const [editEndpoint, setEditEndpoint] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ id: '', type: 'text', baseUrl: '', upstream: '', name: '' });
  const [saving, setSaving] = useState('');
  const [editType, setEditType] = useState('');
  const [stackProvider, setStackProvider] = useState('');
  const [stackUrl, setStackUrl] = useState('');
  const [stackUpstream, setStackUpstream] = useState('');
  const [stackKey, setStackKey] = useState('');

  const load = async () => {
    const res = await fetch('/api/admin/config');
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    setBlocked(data.config?.blocked_models ?? []);
    setPinned(data.config?.pinned_models ?? []);
    setRules(data.config?.model_rules ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (key: string, value: string[]) => {
    setSaving(key);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    setSaving('');
  };

  const toggleBlock = async (id: string) => {
    const next = blocked.includes(id) ? blocked.filter((x) => x !== id) : [...blocked, id];
    setBlocked(next);
    await save('blocked_models', next);
  };

  const togglePin = async (id: string) => {
    const next = pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id];
    setPinned(next);
    await save('pinned_models', next);
  };

  const addRule = async (line: string) => {
    const next = [...rules, line];
    setRules(next);
    await save('model_rules', next);
  };

  const removeRule = async (idx: number) => {
    const next = rules.filter((_, i) => i !== idx);
    setRules(next);
    await save('model_rules', next);
  };

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return catalog.filter((m) => {
      if (blockedOnly && !blocked.includes(m.id)) return false;
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (!q) return true;
      return m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
    });
  }, [catalog, filter, typeFilter, blockedOnly, blocked]);

  const types = Array.from(new Set(catalog.map((m) => m.type)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
        <div className="relative flex-1 min-w-[200px]">
          <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search models or providers..." className="input-dark pl-10 py-2" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-dark w-40">
          <option value="all">All types ({catalog.length})</option>
          {types.map((t) => (
            <option key={t} value={t}>{t} ({catalog.filter((m) => m.type === t).length})</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => setBlockedOnly((v) => !v)}
          className={`rounded-full px-3 py-1 font-medium ${blockedOnly ? 'bg-red-500/25 text-red-200' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
        >
          {blocked.length} blocked{blockedOnly ? ' — showing only these' : ''}
        </button>
        <span className="rounded-full bg-white/5 px-3 py-1 text-zinc-400">{pinned.length} pinned</span>
        <span className="rounded-full bg-white/5 px-3 py-1 text-zinc-400">{rules.length} rules</span>
        <button
          onClick={async () => {
            if (!confirm(`Block every model where aquadevs is the only provider? This will add ${catalog.filter((m) => m.provider === 'aquadevs').length} models to the block list.`)) return;
            const res = await fetch('/api/admin/models/block-aquadevs-only', { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              setBlocked((prev) => {
                const set = new Set([...prev, ...(data.blocked ?? [])]);
                return Array.from(set);
              });
            }
          }}
          className="rounded-full bg-amber-500/15 px-3 py-1 font-medium text-amber-300 hover:bg-amber-500/25"
        >
          Block all aquadevs-only
        </button>
        <button
          onClick={async () => {
            if (!confirm('Disable every model whose providers are ALL limited (aquadevs, nvidia, cloudflare)? Models with at least one unlimited provider stay available.')) return;
            const res = await fetch('/api/admin/models/block-limited-single-provider', { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              setBlocked((prev) => {
                const set = new Set([...prev, ...(data.blocked ?? [])]);
                return Array.from(set);
              });
              alert(`Disabled ${data.added ?? 0} models (${data.total ?? '?'} total blocked).`);
            } else {
              alert('Failed to disable limited-only models.');
            }
          }}
          className="rounded-full bg-red-500/15 px-3 py-1 font-medium text-red-300 hover:bg-red-500/25"
        >
          Disable limited-only models
        </button>
        <button
          onClick={async () => {
            if (!confirm('Disable every model with availability under 20% (based on the last 24h)?')) return;
            const res = await fetch('/api/admin/models/block-low-availability', { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              setBlocked((prev) => {
                const set = new Set([...prev, ...(data.blocked ?? [])]);
                return Array.from(set);
              });
              alert(`Disabled ${data.added ?? 0} models with <20% availability (${data.total ?? '?'} total blocked).`);
            } else {
              alert('Failed to disable low-availability models.');
            }
          }}
          className="rounded-full bg-orange-500/15 px-3 py-1 font-medium text-orange-300 hover:bg-orange-500/25"
        >
          Disable &lt;20% availability
        </button>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Add custom model</h3>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-ghost px-3 py-1.5 text-xs">{showAdd ? 'Cancel' : '+ Add model'}</button>
        </div>
        {showAdd && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input placeholder="public id (e.g. my-model)" value={addForm.id} onChange={(e) => setAddForm({ ...addForm, id: e.target.value })} className="input-dark font-mono text-xs" />
            <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })} className="input-dark">
              <option value="text">text</option>
              <option value="image">image</option>
              <option value="tts">tts</option>
              <option value="stt">stt</option>
              <option value="embedding">embedding</option>
              <option value="video">video</option>
            </select>
            <input placeholder="https://api.example.com/v1" value={addForm.baseUrl} onChange={(e) => setAddForm({ ...addForm, baseUrl: e.target.value })} className="input-dark font-mono text-xs" />
            <input placeholder="upstream model id" value={addForm.upstream} onChange={(e) => setAddForm({ ...addForm, upstream: e.target.value })} className="input-dark font-mono text-xs" />
            <input placeholder="Display name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className="input-dark sm:col-span-2" />
            <button
              onClick={async () => {
                if (!addForm.id || !addForm.baseUrl) return;
                await addRule(`add | ${addForm.id} | ${addForm.type} | ${addForm.baseUrl} | ${addForm.upstream || addForm.id} | ${addForm.name || addForm.id}`);
                setAddForm({ id: '', type: 'text', baseUrl: '', upstream: '', name: '' });
                setShowAdd(false);
              }}
              className="btn-primary sm:col-span-2"
            >
              Create model
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((m) => {
          const isBlocked = blocked.includes(m.id);
          const isPinned = pinned.includes(m.id);
          const isEditing = editing === m.id;
          return (
            <div key={m.id} className={`card p-4 ${isBlocked ? 'opacity-50' : ''}`} style={{ borderColor: isPinned ? '#ffffff' : undefined }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-medium text-zinc-100">{m.id}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-300" style={{ background: '#1D1D1F', border: '0.5px solid #2d2d2d' }}>{m.type}</span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">{m.provider}</span>
                    {isPinned && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">PINNED</span>}
                    {isBlocked && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">BLOCKED</span>}
                  </div>
                </div>
                <button onClick={() => setEditing(isEditing ? null : m.id)} className="btn-ghost shrink-0 px-2 py-1 text-xs">{isEditing ? 'Close' : 'Edit'}</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button onClick={() => toggleBlock(m.id)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${isBlocked ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-300 hover:bg-red-500/20'}`}>
                  {isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button onClick={() => togglePin(m.id)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${isPinned ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                  {isPinned ? 'Unpin' : 'Pin'}
                </button>
              </div>
              {isEditing && (
                <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex gap-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="New display name" className="input-dark flex-1 py-1.5 text-xs" />
                    <button onClick={async () => { if (!editName) return; await addRule(`name | ${m.id} | ${editName}`); setEditName(''); }} className="btn-ghost shrink-0 px-2 py-1 text-xs">Set name</button>
                  </div>
                  <div className="flex gap-2">
                    <input value={editId} onChange={(e) => setEditId(e.target.value)} placeholder="New ID" className="input-dark flex-1 py-1.5 font-mono text-xs" />
                    <button onClick={async () => { if (!editId) return; await addRule(`rename | ${m.id} | ${editId}`); setEditId(''); }} className="btn-ghost shrink-0 px-2 py-1 text-xs">Rename</button>
                  </div>
                  <div className="flex gap-2">
                    <input value={editEndpoint} onChange={(e) => setEditEndpoint(e.target.value)} placeholder="https://new-endpoint/v1" className="input-dark flex-1 py-1.5 font-mono text-xs" />
                    <button onClick={async () => { if (!editEndpoint) return; await addRule(`endpoint | ${m.id} | ${editEndpoint}`); setEditEndpoint(''); }} className="btn-ghost shrink-0 px-2 py-1 text-xs">Move</button>
                  </div>
                  <div className="flex gap-2">
                    <select value={editType} onChange={(e) => setEditType(e.target.value)} className="input-dark flex-1 py-1.5 text-xs">
                      <option value="">Change type…</option>
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="tts">TTS / Speech</option>
                      <option value="stt">STT / Transcribe</option>
                      <option value="embedding">Embedding</option>
                      <option value="video">Video</option>
                    </select>
                    <button onClick={async () => { if (!editType || editType === m.type) return; await addRule(`type | ${m.id} | ${editType}`); setEditType(''); load(); }} className="btn-ghost shrink-0 px-2 py-1 text-xs">Set type</button>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <p className="text-[10px] font-semibold uppercase text-zinc-500 mb-2">Add provider pipe</p>
                    <div className="grid gap-1.5 grid-cols-2">
                      <input value={stackProvider} onChange={(e) => setStackProvider(e.target.value)} placeholder="Provider name (e.g. custom)" className="input-dark py-1.5 text-xs" />
                      <input value={stackUpstream} onChange={(e) => setStackUpstream(e.target.value)} placeholder="Upstream model ID" className="input-dark py-1.5 font-mono text-xs" />
                      <input value={stackUrl} onChange={(e) => setStackUrl(e.target.value)} placeholder="https://api.example.com/v1" className="input-dark py-1.5 font-mono text-xs" />
                      <input value={stackKey} onChange={(e) => setStackKey(e.target.value)} placeholder="API key (optional)" className="input-dark py-1.5 font-mono text-xs" />
                    </div>
                    <button onClick={async () => { if (!stackProvider || !stackUrl || !stackUpstream) return; await addRule(`stack | ${m.id} | ${stackProvider} | ${stackUrl} | ${stackUpstream}${stackKey ? ' | ' + stackKey : ''}`); setStackProvider(''); setStackUrl(''); setStackUpstream(''); setStackKey(''); load(); }} className="mt-2 btn-ghost w-full px-2 py-1 text-xs">Add pipe</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rules.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Active rules ({rules.length})</h3>
          <ul className="mt-3 space-y-1.5">
            {rules.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 font-mono text-xs text-zinc-400">
                <span className="truncate">{r}</span>
                <button onClick={() => removeRule(i)} className="shrink-0 text-red-400 hover:text-red-300">×</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
