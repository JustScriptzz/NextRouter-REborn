'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createElement } from 'react';

import { apiErrorMessage } from '@/lib/api-error';

const ALTCHA_ENABLED = process.env.NEXT_PUBLIC_ALTCHA_ENABLED === 'true';

export function ClientRegisterForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      router.push('/models');
      router.refresh();
    } finally {
      setLoading(false);
    }
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
