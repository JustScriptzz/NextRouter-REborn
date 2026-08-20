'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiErrorMessage } from '@/lib/api-error';

export function ClientRegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="mb-1 block text-sm text-zinc-400">
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
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
        />
        <p className="mt-1 text-xs text-zinc-600">
          3-32 characters: lowercase letters, numbers, underscores and dashes.
        </p>
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-zinc-400">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-zinc-400">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
        />
        <p className="mt-1 text-xs text-zinc-600">At least 8 characters.</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
      >
        {loading ? 'Creating account&hellip;' : 'Sign up'}
      </button>
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <a href="/login" className="text-violet-400 hover:text-violet-300">
          Log in
        </a>
      </p>
    </form>
  );
}