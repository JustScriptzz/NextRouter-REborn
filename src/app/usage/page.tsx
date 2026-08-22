'use client';

import { useCallback, useEffect, useState } from 'react';

interface UsageSummaryDTO {
  today: { tokens: number; calls: number };
  total: { tokens: number; calls: number };
  limit: number;
  remaining: number;
  last7: Array<{ date: string; tokens: number; calls: number }>;
  unlimited?: boolean;
}

import { apiErrorMessage } from '@/lib/api-error';

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlimited, setUnlimited] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/usage');
    if (!res.ok) {
      if (res.status === 401) window.location.href = '/login';
      const data = await res.json().catch(() => ({}));
      setError(apiErrorMessage(data, 'Failed to load usage'));
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsage(data.usage);
    setUnlimited(!!data.unlimited);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400" />
        <p className="mt-4 text-sm text-zinc-500">Loading usage...</p>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="py-10 text-center text-sm text-red-400">{error ?? 'Failed to load usage'}</div>
    );
  }

  const pct = Math.min(100, Math.round((usage.today.tokens / usage.limit) * 100));
  const breakdown = [...usage.last7].reverse();
  const maxDay = Math.max(1, ...breakdown.map((d) => d.tokens));

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="anim-fade-up">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Usage</h1>
          {unlimited && (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-3 py-1 text-xs font-bold tracking-wide text-violet-300">
              UNLIMITED
            </span>
          )}
        </div>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
          {unlimited
            ? 'Your account has no daily cap — usage is tracked for display only and never blocks requests.'
            : 'The daily limit applies to everything combined, across all models. It resets at midnight UTC.'}
        </p>
      </div>

      <div className="anim-fade-up delay-1 mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Tokens today"
          value={usage.today.tokens.toLocaleString()}
          sub={unlimited ? 'Unlimited' : `of ${usage.limit.toLocaleString()}`}
          icon={<IconBolt />}
          accent="text-violet-300"
        />
        <StatCard
          label="Calls today"
          value={usage.today.calls.toLocaleString()}
          icon={<IconCall />}
          accent="text-cyan-300"
        />
        <StatCard
          label="All-time tokens"
          value={usage.total.tokens.toLocaleString()}
          icon={<IconStack />}
          accent="text-fuchsia-300"
        />
        <StatCard
          label="All-time calls"
          value={usage.total.calls.toLocaleString()}
          icon={<IconClock />}
          accent="text-emerald-300"
        />
      </div>

      {unlimited ? (
        <div className="card anim-fade-up delay-2 mt-6 border-violet-500/30 bg-violet-500/10 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
              ∞
            </span>
            <div>
              <div className="text-sm font-semibold text-violet-200">Unlimited — no daily cap</div>
              <div className="text-xs text-violet-300/70">
                {usage.today.tokens.toLocaleString()} tokens used today · never blocked
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card anim-fade-up delay-2 mt-6 p-5">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-300">Daily budget used</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                pct >= 90
                  ? 'bg-red-500/15 text-red-300'
                  : pct >= 60
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {pct}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/10">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                pct >= 90
                  ? 'bg-gradient-to-r from-red-600 to-red-400'
                  : pct >= 60
                    ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                    : 'bg-gradient-to-r from-violet-600 to-cyan-400'
              }`}
              style={{ width: `${Math.max(pct, 1)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-zinc-500">
            <span>{usage.today.tokens.toLocaleString()} tokens used</span>
            <span>{usage.remaining.toLocaleString()} remaining</span>
          </div>
        </div>
      )}

      {breakdown.length > 0 && (
        <>
          <div className="card anim-fade-up delay-3 mt-6 p-5">
            <h2 className="mb-4 text-sm font-semibold text-zinc-200">Last 7 days</h2>
            <div className="flex h-36 items-end gap-2 sm:gap-3">
              {breakdown.map((d) => {
                const h = Math.max(4, Math.round((d.tokens / maxDay) * 100));
                return (
                  <div key={d.date} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="relative flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-violet-600/70 to-cyan-400/70 opacity-80 transition-all group-hover:opacity-100"
                        style={{ height: `${h}%` }}
                      />
                      <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300 opacity-0 transition group-hover:opacity-100">
                        {d.tokens.toLocaleString()}
                      </span>
                    </div>
                    <span className="w-full truncate text-center font-mono text-[10px] text-zinc-500">
                      {shortDate(d.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card anim-fade-up delay-4 mt-6 overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Calls</th>
                  <th className="px-5 py-3 text-right font-medium">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.date} className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.02]">
                    <td className="px-5 py-2.5 text-zinc-300">{row.date}</td>
                    <td className="px-5 py-2.5 text-zinc-400">{row.calls.toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-zinc-400">
                      {row.tokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function shortDate(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="card card-hover p-5">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] ${accent}`}>
        {icon}
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-zinc-100">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M11 2L4 11h5l-1 7 7-9h-5l1-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconCall() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 3h3l1.5 4L6.5 8.5a10 10 0 005 5L13 11.5l4 1.5v3a1.5 1.5 0 01-1.6 1.5C8.6 17 3 11.4 2.5 4.6A1.5 1.5 0 014 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconStack() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M10 3l7 3.5-7 3.5-7-3.5L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 10.5l7 3.5 7-3.5M3 14l7 3.5 7-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4.5l3 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
