'use client';

import { useEffect, useState } from 'react';

const SECTIONS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'blocked_models', label: 'Blocked models', hint: 'One model ID per line — hidden from catalog and unroutable.' },
  { key: 'pinned_models', label: 'Pinned models', hint: 'One ID per line — shown first on the models page, in order.' },
  { key: 'unlimited_emails', label: 'Unlimited emails', hint: 'Extra emails with no daily cap (beyond hardcoded owners).' },
  { key: 'disabled_providers', label: 'Disabled providers', hint: 'Provider names to skip entirely (e.g. jankrouter).' },
  { key: 'banner', label: 'Global banner', hint: 'First line is shown site-wide to every user. Empty = off.' },
];

export default function AdminConfig() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((d) => {
        const cfg = d?.config ?? {};
        const next: Record<string, string> = {};
        for (const s of SECTIONS) next[s.key] = (cfg[s.key] ?? []).join('\n');
        setValues(next);
      })
      .catch(() => undefined);
  }, []);

  async function save(key: string) {
    setSaving(key);
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: (values[key] ?? '').split('\n').map((v) => v.trim()).filter(Boolean),
        }),
      });
      setSaved(key);
      setTimeout(() => setSaved(''), 1500);
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map((s) => (
        <div key={s.key} className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{s.label}</h3>
              <p className="mt-0.5 text-xs text-zinc-500">{s.hint}</p>
            </div>
            <button
              type="button"
              onClick={() => save(s.key)}
              disabled={saving === s.key}
              className={`btn-ghost shrink-0 px-3 py-1.5 text-xs ${
                saved === s.key ? 'border-emerald-500/50 text-emerald-300' : ''
              }`}
            >
              {saving === s.key ? 'Saving...' : saved === s.key ? 'Saved' : 'Save'}
            </button>
          </div>
          <textarea
            value={values[s.key] ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, [s.key]: e.target.value }))}
            rows={s.key === 'banner' ? 2 : 4}
            spellCheck={false}
            className="input-dark mt-3 font-mono text-xs"
          />
        </div>
      ))}
    </div>
  );
}
