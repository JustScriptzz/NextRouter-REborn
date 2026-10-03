'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MODELS } from '@/lib/shell-config';

type Msg = { role: 'user' | 'assistant'; text: string; meta?: string };

const CANNED = [
  'No key set above — paste one (or the demo key) to make live calls. Echoing locally meanwhile.',
  'Pick a model on the left first — then anything you type goes to the real thing.',
];

export default function PlaygroundShell() {
  const [model, setModel] = useState(MODELS[0]?.id ?? '');
  const [key, setKey] = useState('');
  const [input, setInput] = useState('');
  const [temp, setTemp] = useState(0.8);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', text: 'Hey. The catalog is live — pick a model, paste your key, and talk to it for real. No key yet? Anything you type just echoes locally.', meta: 'live ready' },
  ]);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nr_key');
      if (saved) setKey(saved);
    } catch {}
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  function saveKey(v: string) {
    setKey(v);
    try {
      if (v.trim()) localStorage.setItem('nr_key', v.trim());
      else localStorage.removeItem('nr_key');
    } catch {}
  }

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    const userMsg: Msg = { role: 'user', text };
    setMsgs((m) => [...m, userMsg]);
    setInput('');

    // No key or no model: local echo so the layout works offline.
    if (!key.trim() || !model) {
      setBusy(true);
      const n = msgs.length;
      setTimeout(() => {
        const reply =
          text.toLowerCase().includes('key')
            ? 'Paste a key above (or the shared demo key) and the playground will remember it.'
            : text.toLowerCase().includes('limit')
              ? '50,000,000 tokens a day, all models combined. Resets 00:00 UTC.'
              : `${CANNED[n % CANNED.length]} You said: “${text.slice(0, 140)}${text.length > 140 ? '…' : ''}”`;
        setMsgs((m) => [...m, { role: 'assistant', text: reply, meta: 'echo (no live call)' }]);
        setBusy(false);
      }, 500);
      return;
    }

    // Live call through the gateway.
    setBusy(true);
    const thread = [...msgs, userMsg].map((m) => ({ role: m.role, content: m.text }));
    const activeModel = model;
    fetch('/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: activeModel, messages: thread, temperature: temp }),
    })
      .then(async (res) => {
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            (j && j.error && (j.error.message || j.error)) || (j && j.message) || `HTTP ${res.status}`;
          throw new Error(String(msg));
        }
        const content =
          j?.choices?.[0]?.message?.content ?? j?.choices?.[0]?.text ?? '(empty reply)';
        setMsgs((m) => [
          ...m,
          { role: 'assistant', text: String(content), meta: `${activeModel} · live` },
        ]);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        const hint = /401|invalid|unauthorized|key/i.test(msg)
          ? ' Check your key — use the demo key or mint your own (see keys tab).'
          : /429|limit|rate/i.test(msg)
            ? ' Limit hit — wait a bit and retry.'
            : /404|not found/i.test(msg)
              ? ' That model id isn’t on the gateway right now.'
              : '';
        setMsgs((m) => [
          ...m,
          { role: 'assistant', text: `Call failed: ${msg}.${hint}`, meta: 'error' },
        ]);
      })
      .finally(() => setBusy(false));
  }

  const active = MODELS.find((m) => m.id === model);

  return (
    <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
      <div className="panel panel-pad h-fit">
        <div className="micro">Model</div>
        <select value={model} onChange={(e) => setModel(e.target.value)} disabled={MODELS.length === 0} className="field mono mt-2 text-[12px]">
          {MODELS.length === 0 ? (
            <option value="">No models wired yet</option>
          ) : (
            MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.id} — {m.type}</option>
            ))
          )}
        </select>
        {active && <p className="mt-2 text-[12px] leading-snug text-neutral-500">{active.label}. {active.note}</p>}

        <div className="micro mt-4">API key (discord-issued)</div>
        <input
          value={key}
          onChange={(e) => saveKey(e.target.value)}
          placeholder="nr_… paste here"
          spellCheck={false}
          className="field mono mt-2 text-[12px]"
        />
        <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">
          Stored in localStorage only. No key yet? <Link href="/keys" className="underline underline-offset-4 hover:text-white">keys tab</Link>.
        </p>

        <div className="micro mt-4">Temperature — {temp.toFixed(1)}</div>
        <input type="range" min={0} max={1.5} step={0.1} value={temp} onChange={(e) => setTemp(parseFloat(e.target.value))} className="mt-2 w-full accent-white" />
        <p className="mono mt-3 border-t border-neutral-800 pt-2 text-[11px] text-neutral-600">
          {key.trim() && model ? 'live calls · tokens count against your cap' : 'no key set — echo mode, no tokens spent'}
        </p>
      </div>

      <div className="panel flex min-h-[480px] flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 520 }}>
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === 'user' ? 'bg-white text-black' : 'border border-neutral-800 bg-neutral-950 text-neutral-200'
                }`}
                style={{ borderRadius: 6 }}
              >
                {m.meta && m.role === 'assistant' && <div className="mono mb-1 text-[10px] uppercase tracking-wider text-neutral-600">{m.meta}</div>}
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            </div>
          ))}
          {busy && <div className="mono text-[12px] text-neutral-600">… thinking (locally)</div>}
          <div ref={bottom} />
        </div>
        <div className="border-t border-neutral-800 p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={model ? `Message ${model}…` : 'Pick a model first'}
              className="field"
            />
            <button onClick={send} disabled={busy || !input.trim()} className="btn btn-solid shrink-0 px-5">Send</button>
          </div>
          <div className="mono mt-2 flex justify-between text-[11px] text-neutral-600">
            <button onClick={() => setMsgs([])} className="hover:text-white">clear thread</button>
            <span>enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
