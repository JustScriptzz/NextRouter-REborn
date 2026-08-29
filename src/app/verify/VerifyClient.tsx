'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function VerifyClient() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [state, setState] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading');
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('no-token');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.verified) {
          setState('success');
        } else {
          setState('error');
          setError((data as { error?: { message?: string } }).error?.message ?? 'Verification failed.');
        }
      } catch {
        setState('error');
        setError('Network error.');
      }
    })();
  }, [token]);

  async function resend() {
    if (!email) return;
    setResending(true);
    setResendMsg('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setResendMsg((data as { message?: string; error?: { message?: string } }).message ?? (data as { error?: { message?: string } }).error?.message ?? (res.ok ? 'Sent.' : 'Could not resend.'));
    } catch {
      setResendMsg('Network error.');
    }
    setResending(false);
  }

  if (state === 'loading') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-32">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
        <p className="mt-4 text-sm text-zinc-500">Verifying your email…</p>
      </div>
    );
  }

  if (state === 'no-token') {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-semibold text-zinc-100">Verify your email</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Check your inbox — we sent you a verification link. Click it to activate your account.
        </p>
        {email && (
          <button onClick={resend} disabled={resending} className="btn-ghost mx-auto mt-6">
            {resending ? 'Sending…' : 'Resend verification email'}
          </button>
        )}
        {resendMsg && <p className="mt-3 text-xs text-zinc-400">{resendMsg}</p>}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ border: '0.5px solid #2d2d2d', background: '#1D1D1F' }}>
          <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6 text-red-400" aria-hidden>
            <path d="M10 6v4m0 3.5v.5M10 3l8 14H2L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-zinc-100">Verification failed</h1>
        <p className="mt-2 text-sm text-zinc-400">{error}</p>
        {email && (
          <button onClick={resend} disabled={resending} className="btn-ghost mx-auto mt-6">
            {resending ? 'Sending…' : 'Resend verification email'}
          </button>
        )}
        <div className="mt-6">
          <Link href="/register" className="text-sm text-white underline">Register again</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ border: '0.5px solid #2d2d2d', background: '#1D1D1F' }}>
        <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6 text-white" aria-hidden>
          <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-zinc-100">Email verified</h1>
      <p className="mt-2 text-sm text-zinc-400">Your account is active. You can now log in and use the gateway.</p>
      <div className="mt-6">
        <Link href="/models" className="btn-primary">Continue</Link>
      </div>
    </div>
  );
}