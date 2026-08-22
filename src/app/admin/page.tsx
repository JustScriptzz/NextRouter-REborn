import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { getCatalog, getGatewaysHealth } from '@/lib/providers';
import AdminRefresh from './AdminRefresh';

export const metadata: Metadata = {
  title: 'Admin',
};

export const dynamic = 'force-dynamic';

function ago(ts: number | null): string {
  if (ts === null) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function badgeFor(g: { configured: boolean; cachedModels: number | null; lastSuccessAt: number | null }) {
  if (!g.configured) {
    return { label: 'Not configured', cls: 'bg-zinc-800 text-zinc-400' };
  }
  if (g.cachedModels !== null && g.cachedModels > 0) {
    return { label: 'Healthy', cls: 'bg-emerald-500/15 text-emerald-300' };
  }
  if (g.lastSuccessAt !== null) {
    return { label: 'Stale cache', cls: 'bg-amber-500/15 text-amber-300' };
  }
  return { label: 'Down', cls: 'bg-red-500/15 text-red-300' };
}

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="py-20 text-center text-sm text-zinc-500">
        Not signed in. <Link href="/login" className="text-violet-300">Log in</Link>
      </div>
    );
  }
  if (!isAdminEmail(user.email)) {
    return <div className="py-20 text-center text-sm text-red-400">Admin only.</div>;
  }

  const health = getGatewaysHealth();
  const catalog = await getCatalog();
  const byProvider = new Map<string, number>();
  for (const m of catalog.models) {
    byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="anim-fade-up flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Admin</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Signed in as {user.email} · catalog total <strong className="text-zinc-200">{catalog.models.length}</strong> models
          </p>
        </div>
        <AdminRefresh />
      </div>

      <div className="card anim-fade-up delay-1 mt-6 overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-3 font-medium">Provider</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Models</th>
              <th className="px-5 py-3 text-right font-medium">Last poll</th>
            </tr>
          </thead>
          <tbody>
            {health.map((g) => {
              const serving = byProvider.get(g.provider) ?? 0;
              const badge = badgeFor(g);
              return (
                <tr key={g.provider} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-zinc-300">{g.provider}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-zinc-400">{serving}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-zinc-500">{ago(g.lastAttemptAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
