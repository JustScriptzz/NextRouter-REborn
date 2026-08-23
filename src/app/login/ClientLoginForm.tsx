'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiErrorMessage } from '@/lib/api-error';

export function ClientLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(data, 'Login failed'));
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
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-zinc-400">
            Password
          </label>
          <button
            type="button"
            onClick={() => {
              const target = 'nextrouter@aster.cx';
              const subject = encodeURIComponent('Password reset request - NextRouter');
              const body = encodeURIComponent(
                `Hello NextRouter team,\n\nI need a password reset for my account${email ? ` (${email})` : ''}.\n\nPlease help me reset my password.\n\nThanks!`,
              );
              const mailtoUrl = `mailto:${target}?subject=${subject}&body=${body}`;
              // Always auto-open the native email compose interface
              const a = document.createElement('a');
              a.href = mailtoUrl;
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              // Also open the user's webmail provider in a new tab for convenience
              const domain = email.split('@')[1]?.toLowerCase() ?? '';
              let webUrl: string | null = null;
              if (domain === 'gmail.com' || domain === 'googlemail.com') {
                webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${target}&su=${subject}&body=${body}`;
              } else if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com' || domain === 'outlook.fr') {
                webUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${target}&subject=${subject}&body=${body}`;
              } else if (domain === 'yahoo.com') {
                webUrl = `https://compose.mail.yahoo.com/?to=${target}&subject=${subject}&body=${body}`;
              } else if (domain === 'proton.me' || domain === 'protonmail.com' || domain === 'pm.me') {
                webUrl = `https://mail.proton.me/u/0/all-mail#compose;to=${target}`;
              } else if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
                webUrl = `https://www.icloud.com/mail/`;
              }
              if (webUrl) window.open(webUrl, '_blank', 'noopener');
            }}
            className="text-xs font-medium text-violet-400 transition hover:text-violet-300"
          >
            Forgot password?
          </button>
        </div>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-dark"
        />
      </div>
      {error && (
        <div className="anim-fade-in rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Logging in...
          </span>
        ) : (
          'Log in'
        )}
      </button>
      <p className="text-center text-sm text-zinc-500">
        No account?{' '}
        <a href="/register" className="font-medium text-violet-400 transition hover:text-violet-300">
          Sign up
        </a>
      </p>
    </form>
  );
}
