'use client';

import Link from 'next/link';

export default function LimitsPage() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="anim-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Limits</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
          One fixed policy for everyone. No accounts, no requests, no increases.
        </p>
      </div>

      <div className="anim-fade-up delay-1 card mt-6 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Rate limit</p>
            <p className="mt-1 text-2xl font-bold text-zinc-50">20<span className="text-sm font-medium text-zinc-400">/min</span></p>
            <p className="mt-1 text-xs text-zinc-500">per IP address</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Daily quota</p>
            <p className="mt-1 text-2xl font-bold text-zinc-50">500<span className="text-sm font-medium text-zinc-400">/day</span></p>
            <p className="mt-1 text-xs text-zinc-500">per IP, resets midnight UTC</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Increases</p>
            <p className="mt-1 text-2xl font-bold text-zinc-50">Off</p>
            <p className="mt-1 text-xs text-zinc-500">same for everyone</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Hitting 429? Slow down and retry — the minute window resets every minute,
          the daily quota at midnight UTC. Admins are exempt from both gates.
        </p>
        <Link href="/docs" className="btn-primary mt-4 inline-flex">
          Get the public key
        </Link>
      </div>
    </div>
  );
}
