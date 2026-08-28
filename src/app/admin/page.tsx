import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { getCatalog, getGatewaysHealth } from '@/lib/providers';
import { db } from '@/lib/db/client';
import { dailyUsage, users } from '@/lib/db/schema';
import AdminRefresh from './AdminRefresh';
import AdminConfig from './AdminConfig';
import AdminModels from './AdminModels';
import AdminUserManagement from './AdminUserManagement';
import AdminRequests from './AdminRequests';
import AdminMessages from './AdminMessages';

export const metadata: Metadata = {
  title: 'Admin',
};

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'models', label: 'Models' },
  { key: 'providers', label: 'Providers' },
  { key: 'access', label: 'Access' },
  { key: 'broadcast', label: 'Broadcast' },
  { key: 'requests', label: 'Limits Requests' },
  { key: 'messages', label: 'Messages' },
];

function ago(ts: number | null): string {
  if (ts === null) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function badgeFor(g: { configured: boolean; cachedModels: number | null; lastSuccessAt: number | null }) {
  if (!g.configured) return { label: 'Not configured', cls: 'bg-zinc-800 text-zinc-400' };
  if (g.cachedModels !== null && g.cachedModels > 0) return { label: 'Healthy', cls: 'bg-emerald-500/15 text-emerald-300' };
  if (g.lastSuccessAt !== null) return { label: 'Stale cache', cls: 'bg-amber-500/15 text-amber-300' };
  return { label: 'Down', cls: 'bg-red-500/15 text-red-300' };
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
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

  const params = (await searchParams) ?? {};
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : 'overview';

  const health = getGatewaysHealth();
  const catalog = await getCatalog();
  const byProvider = new Map<string, number>();
  for (const m of catalog.models) {
    byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + 1);
  }
  const catalogIds = catalog.models.map((m) => m.id).sort();

  let totals = { tokens: 0, calls: 0 };
  let todayTotals = { tokens: 0, calls: 0 };
  let topUsers: Array<{ username: string; email: string; tokens: number; calls: number }> = [];
  let userCount = 0;
  if (tab === 'overview' || tab === 'access') {
    const t = await db
      .select({ tokens: sql<number>`coalesce(sum(${dailyUsage.tokens}), 0)`, calls: sql<number>`coalesce(sum(${dailyUsage.calls}), 0)` })
      .from(dailyUsage);
    totals = { tokens: Number(t[0]?.tokens ?? 0), calls: Number(t[0]?.calls ?? 0) };
    const todayStr = new Date().toISOString().slice(0, 10);
    const tt = await db
      .select({ tokens: sql<number>`coalesce(sum(${dailyUsage.tokens}), 0)`, calls: sql<number>`coalesce(sum(${dailyUsage.calls}), 0)` })
      .from(dailyUsage)
      .where(eq(dailyUsage.date, todayStr));
    todayTotals = { tokens: Number(tt[0]?.tokens ?? 0), calls: Number(tt[0]?.calls ?? 0) };
    topUsers = await db
      .select({
        username: users.username,
        email: users.email,
        tokens: sql<number>`coalesce(sum(${dailyUsage.tokens}), 0)`,
        calls: sql<number>`coalesce(sum(${dailyUsage.calls}), 0)`,
      })
      .from(users)
      .leftJoin(dailyUsage, eq(dailyUsage.userId, users.id))
      .groupBy(users.id, users.username, users.email)
      .orderBy(desc(sql`coalesce(sum(${dailyUsage.tokens}), 0)`))
      .limit(15);
    const uc = await db.select({ n: sql<number>`count(*)` }).from(users);
    userCount = Number(uc[0]?.n ?? 0);
  }

  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="anim-fade-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Admin</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {user.email} · catalog total <strong className="text-zinc-200">{catalog.models.length}</strong> models
          </p>
        </div>
        <AdminRefresh />
      </div>

      <nav className="mt-6 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? 'bg-violet-500/20 text-violet-200' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <div className="anim-fade-up mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="card p-5">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Users</div>
              <div className="mt-1 text-xl font-bold text-zinc-100">{userCount}</div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Tokens today</div>
              <div className="mt-1 text-xl font-bold text-zinc-100">{todayTotals.tokens.toLocaleString()}</div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Calls today</div>
              <div className="mt-1 text-xl font-bold text-zinc-100">{todayTotals.calls.toLocaleString()}</div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">All-time tokens</div>
              <div className="mt-1 text-xl font-bold text-zinc-100">{totals.tokens.toLocaleString()}</div>
            </div>
          </div>

          <h2 className="mb-3 mt-8 text-lg font-semibold text-zinc-100">Provider health</h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Catalog</th>
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
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-zinc-400">{serving}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-zinc-500">{ago(g.lastAttemptAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h2 className="mb-3 mt-8 text-lg font-semibold text-zinc-100">Top users</h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Calls</th>
                  <th className="px-5 py-3 text-right font-medium">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u) => (
                  <tr key={u.email} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="text-zinc-200">@{u.username}</div>
                      <div className="text-xs text-zinc-500">{u.email}</div>
                    </td>
                    <td className="px-5 py-2.5 tabular-nums text-zinc-400">{Number(u.calls).toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs text-zinc-400">{Number(u.tokens).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

{(tab === 'models' || tab === 'providers' || tab === 'access' || tab === 'broadcast' || tab === 'requests' || tab === 'messages') && (
        <div className="mt-6">
          {tab === 'models' && (
            <AdminModels
              catalog={catalog.models.map((m) => ({
                id: m.id,
                type: m.type,
                provider: m.provider,
                description: m.description,
              }))}
            />
          )}
          {tab === 'providers' && <AdminConfig sections={['disabled_providers', 'extra_gateways']} />}
          {tab === 'access' && (
            <>
              <AdminConfig sections={['unlimited_emails', 'blocked_email_domains']} />
              <h2 className="mb-3 mt-8 text-lg font-semibold text-zinc-100">Users — manage</h2>
              <AdminUserManagement
                initialUsers={topUsers.map((u) => ({
                  username: u.username,
                  email: u.email,
                  tokens: Number(u.tokens),
                  calls: Number(u.calls),
                }))}
              />
            </>
          )}
          {tab === 'broadcast' && <AdminConfig sections={['banner']} />}
          {tab === 'requests' && <AdminRequests />}
          {tab === 'messages' && <AdminMessages />}
        </div>
      )}
    </div>
  );
}
