'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiErrorMessage } from '@/lib/api-error';
import Turnstile from '@/components/Turnstile';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function ClientRegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Please complete the captcha first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(data, 'Registration failed'));
        setTurnstileToken(null);
        return;
      }
      router.push('/models');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      {TURNSTILE_SITE_KEY && (
        <div>
          <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setTurnstileToken} />
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
        <a href="/login" className="font-medium text-violet-400 transition hover:text-violet-300">
          Log in
        </a>
      </p>
    </form>
  );
}
