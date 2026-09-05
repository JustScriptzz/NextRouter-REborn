'use client';

import { createElement, useEffect, useRef, useState } from 'react';

interface LimitsInfo {
  limits?: { rpm: number; tokenLimit: number };
  unlimited?: boolean;
  usage?: { tokens: number; calls: number };
  remaining?: number;
  decision?: null | { decided: 'accepted' | 'rejected' | 'thinking'; at: number; grantedRpm?: number | null; grantedTokens?: number | null; note?: string };
}

const ALTCHA_ENABLED = process.env.NEXT_PUBLIC_ALTCHA_ENABLED === 'true';

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '∞';
  if (!Number.isFinite(n) || n >= 1e15) return '∞';
  return Number(n).toLocaleString();
}

export default function LimitsPage() {
  const [info, setInfo] = useState<LimitsInfo>({});
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);

  const [rpmChoice, setRpmChoice] = useState<'' | number>(20);
  const [why, setWhy] = useState('');
  const [models, setModels] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [submitMsg, setSubmitMsg] = useState('');
  const [banner, setBanner] = useState<LimitsInfo['decision']>(null);

  useEffect(() => {
    if (!ALTCHA_ENABLED) return;
    if (document.querySelector('script[data-altcha]')) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.js';
    script.type = 'module';
    script.dataset.altcha = '1';
    document.head.appendChild(script);
  }, []);

  async function load() {
    try {
      const res = await fetch('/api/limits');
      if (res.ok) {
        const d = await res.json();
        setInfo(d);
        if (d.decision) {
          setBanner(d.decision);
          setTimeout(() => {
            setBanner(null);
            fetch('/api/limits/ack', { method: 'POST' }).catch(() => {});
          }, 5000);
        }
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!why.trim() || !models.trim()) {
      setSubmitState('error');
      setSubmitMsg('Please fill in the reason and the models you plan to use.');
      return;
    }
    let altchaPayload: string | null = null;
    if (ALTCHA_ENABLED && formRef.current) {
      const input = formRef.current.querySelector<HTMLInputElement>('input[name="altcha"]');
      altchaPayload = input?.value ?? null;
      if (!altchaPayload) {
        setSubmitState('error');
        setSubmitMsg('Please complete the captcha first.');
        return;
      }
    }
    setSubmitState('submitting');
    const res = await fetch('/api/limits/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        altcha: altchaPayload,
        rpm: rpmChoice === '' ? null : Number(rpmChoice),
        why,
        models,
      }),
    }).catch(() => null);
    if (!res) {
      setSubmitState('error');
      setSubmitMsg('Network error — try again.');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setSubmitState('done');
      setSubmitMsg('Request sent! You will see the result next time you open the site.');
    } else {
      setSubmitState('error');
      setSubmitMsg((data as { error?: { message?: string } }).error?.message ?? 'Submission failed.');
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center py-32">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
        <p className="mt-4 text-sm text-zinc-500">Loading your limits…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      {banner && (
        <div className={`anim-fade-in fixed inset-x-0 top-4 z-50 mx-auto flex max-w-lg items-center justify-center gap-2 rounded-2xl border px-5 py-4 text-sm font-medium shadow-2xl backdrop-blur-md ${
          banner.decided === 'accepted'
            ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
            : banner.decided === 'rejected'
              ? 'border-red-500/40 bg-red-950/90 text-red-100'
              : 'border-amber-500/40 bg-amber-950/90 text-amber-100'
        }`}>
          {banner.decided === 'accepted' && <span>✅ Your limit increase was approved! RPM: {fmt(banner.grantedRpm)} · Tokens/day: {fmt(banner.grantedTokens)}</span>}
          {banner.decided === 'rejected' && <span>Your limit increase request was rejected. {banner.note ? `(${banner.note})` : ''}</span>}
          {banner.decided === 'thinking' && <span>Your limit increase request is being reviewed…</span>}
        </div>
      )}

      <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Limits</h1>
      <p className="mt-1 text-sm text-zinc-400">Your current usage and request an increase to your rate limits.</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">RPM</div>
          <div className="mt-1 text-xl font-bold text-zinc-100">{info.unlimited ? '∞' : fmt(info.limits?.rpm)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Tokens/day</div>
          <div className="mt-1 text-xl font-bold text-zinc-100">{info.unlimited ? '∞' : fmt(info.limits?.tokenLimit)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Used today</div>
          <div className="mt-1 text-xl font-bold text-zinc-100">{info.usage ? Number(info.usage.tokens).toLocaleString() : '—'}</div>
          <div className="text-[10px] text-zinc-600">{info.usage?.calls ?? 0} calls</div>
        </div>
      </div>

      <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${(info.remaining ?? 0) <= 0 ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-white/10 bg-white/[0.03] text-zinc-400'}`}>
        Remaining today: <span className="font-mono font-bold text-zinc-100">{info.remaining !== undefined ? fmt(info.remaining) : '—'}</span> tokens
      </div>

      <div className="card mt-6 p-5">
        <h2 className="text-base font-semibold text-zinc-100">Request a higher RPM</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Daily tokens are unlimited by default. If you need a higher requests-per-minute rate, tell us how far up you'd like to go — it'll be reviewed, and you'll see the result here next time you come back.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Increase RPM</label>
            <select value={rpmChoice === '' ? '' : String(rpmChoice)} onChange={(e) => setRpmChoice(e.target.value === '' ? '' : Number(e.target.value))} className="input-dark">
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="300">300</option>
              <option value="600">600</option>
              <option value="1000">1000</option>
              <option value="5000">5000</option>
              <option value="">∞ (unlimited)</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-zinc-400">Why do you need the increase?</label>
          <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={3} maxLength={2000} placeholder="Tell us what you're building or doing..." className="input-dark" />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-zinc-400">Which models do you plan to use?</label>
          <textarea value={models} onChange={(e) => setModels(e.target.value)} rows={2} maxLength={1000} placeholder="e.g. gpt-oss:120b, minimax-m3, claude-opus-5..." className="input-dark font-mono" />
        </div>

        <div className="mt-4" ref={formRef}>
          {ALTCHA_ENABLED && createElement('altcha-widget', {
            challengeurl: '/api/altcha/challenge',
            name: 'altcha',
            style: { '--altcha-color-text': '#a1a1aa' } as React.CSSProperties,
          })}
        </div>

        <button
          onClick={submit}
          disabled={submitState === 'submitting'}
          className="btn-primary mt-5 w-full py-3 text-base"
        >
          {submitState === 'submitting' ? 'Sending…' : 'Send request'}
        </button>
        {submitState === 'done' && <div className="anim-fade-in mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">{submitMsg}</div>}
        {submitState === 'error' && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{submitMsg}</div>}
      </div>
    </div>
  );
}
