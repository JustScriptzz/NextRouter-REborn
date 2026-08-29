'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createElement } from 'react';

import { apiErrorMessage } from '@/lib/api-error';

const ALTCHA_ENABLED = process.env.NEXT_PUBLIC_ALTCHA_ENABLED === 'true';

const MAIL_LINKS: Record<string, string> = {
  gmail: 'https://mail.google.com/mail/u/0/#inbox',
  outlook: 'https://outlook.live.com/mail/0/inbox',
  yahoo: 'https://mail.yahoo.com',
  proton: 'https://mail.proton.me',
};

function mailDomain(email: string): string {
  const m = email.split('@')[1] ?? '';
  if (m.includes('gmail') || m.includes('googlemail')) return 'gmail';
  if (m.includes('outlook') || m.includes('hotmail') || m.includes('live')) return 'outlook';
  if (m.includes('yahoo')) return 'yahoo';
  if (m.includes('proton')) return 'proton';
  return '';
}

export function ClientRegisterForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (!ALTCHA_ENABLED) return;
    if (document.querySelector('script[data-altcha]')) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.js';
    script.type = 'module';
    script.dataset.altcha = '1';
    document.head.appendChild(script);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    let altchaPayload: string | null = null;
    if (ALTCHA_ENABLED && formRef.current) {
      const input = formRef.current.querySelector<HTMLInputElement>('input[name="altcha"]');
      altchaPayload = input?.value ?? null;
      if (!altchaPayload) {
        setError('Please complete the captcha first.');
        return;
      }
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, altchaPayload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(data, 'Registration failed'));
        return;
      }
      if (data?.verification === 'required') {
        setVerificationRequired(true);
        setMessage(data.message ?? 'Check your inbox for a verification link.');
        return;
      }
      // No verification flow (straight login) — go to models
      router.push('/models');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setResendMsg('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setResendMsg(
        (data as { message?: string }).message ??
        ((data as { error?: { message?: string } }).error?.message ?? (res.ok ? 'Sent.' : 'Could not resend.')),
      );
    } catch {
      setResendMsg('Network error.');
    }
    setResending(false);
  }

  if (verificationRequired) {
    const domain = mailDomain(email);
    const inboxUrl = MAIL_LINKS[domain];
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ border: '0.5px solid #2d2d2d', background: '#1D1D1F' }}>
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Check your inbox</h2>
          <p className="mt-1 text-sm text-zinc-400">{message}</p>
          <p className="mt-2 text-sm text-zinc-500">
            Sent to <span className="font-mono text-zinc-300">{email}</span>
          </p>
        </div>
        {inboxUrl && (
          <a href={inboxUrl} target="_blank" rel="noreferrer" className="btn-primary inline-flex">
            Open inbox
          </a>
        )}
        <div>
          <button onClick={resend} disabled={resending} className="btn-ghost">
            {resending ? 'Sending…' : 'Resend verification email'}
          </button>
          {resendMsg && <p className="mt-2 text-xs text-zinc-400">{resendMsg}</p>}
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-zinc-400">
          Username
        </label>
        <input
          id="username"
          type="text"
          required
          minLength={3}
          maxLength={20}
          pattern="[a-z0-9][a-z0-9_-]{2,31}"
          autoComplete="username"
          placeholder="lowercase, numbers, dashes"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input-dark font-mono"
        />
        <p className="mt-1.5 text-xs text-zinc-600">
          3-32 characters: lowercase letters, numbers, underscores and dashes.
        </p>
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-400">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-dark"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-400">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-dark"
        />
        <p className="mt-1.5 text-xs text-zinc-600">At least 8 characters.</p>
      </div>
      {ALTCHA_ENABLED && (
        <div className="altcha-box">
          {createElement('altcha-widget', {
            challengeurl: '/api/altcha/challenge',
            name: 'altcha',
            style: { '--altcha-color-text': '#a1a1aa' } as React.CSSProperties,
          })}
        </div>
      )}
      {error && (
        <div className="anim-fade-in rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Creating account...
          </span>
        ) : (
          'Create account'
        )}
      </button>
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <a href="/login" className="font-medium text-white transition hover:text-zinc-300">
          Log in
        </a>
      </p>
    </form>
  );
}