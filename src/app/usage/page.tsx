'use client';

import { useCallback, useEffect, useState } from 'react';

interface UsageSummaryDTO {
  today: { tokens: number; calls: number };
  total: { tokens: number; calls: number };
  limit: number;
  remaining: number;
  last7: Array<{ date: string; tokens: number; calls: number }>;
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/usage');
    if (!res.ok) {
      if (res.status === 401) window.location.href = '/login';
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? 'Failed to load usage');
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsage(data.usage);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="py-10 text-center text-zinc-500">Loading&hellip;</div>;
  }

  if (error || !usage) {
    return (
      <div className="py-10 text-center text-sm text-red-400">{error ?? 'Failed to load usage'}</div>
    );
  }

  const pct = Math.min(100, Math.round((usage.today.tokens / usage.limit) * 100));
  const breakdown = [...usage.last7].reverse();

  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-2xl font-bold text-zinc-100">Usage</h1>
      <p className="mt-1 text-sm text-zinc-500">
        The 500,000 token/day limit applies to everything combined, across all models. It resets at
        midnight UTC.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Tokens today</div>
          <div className="mt-2 text-2xl font-bold text-zinc-100">
            {usage.today.tokens.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-zinc-500">of {usage.limit.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Calls today</div>
          <div className="mt-2 text-2xl font-bold text-zinc-100">
            {usage.today.calls.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">All-time tokens</div>
          <div className="mt-2 text-2xl font-bold text-zinc-100">
            {usage.total.tokens.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">All-time calls</div>
          <div className="mt-2 text-2xl font-bold text-zinc-100">
            {usage.total.calls.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-zinc-400">Daily budget used</span>
          <span className={pct >= 90 ? 'font-semibold text-red-400' : 'text-zinc-300'}>
            {pct}%
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">Last 7 days</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Calls</th>
                <th className="pb-2 text-right">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row) => (
                <tr key={row.date} className="border-b border-zinc-800/60 last:border-0">
                  <td className="py-2 pr-4 text-zinc-300">{row.date}</td>
                  <td className="py-2 pr-4 text-zinc-400">{row.calls.toLocaleString()}</td>
                  <td className="py-2 text-right text-zinc-400">{row.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}