import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { kvGetCached, kvSet } from '@/lib/config-store';
import { getCatalog } from '@/lib/providers';
import { getModelStats } from '@/lib/model-stats';

export const runtime = 'edge';

// Hides every model whose recent success rate (`avail`, 0-1) is below the
// given threshold. Models with no data yet (avail === null) are left alone -
// there's no evidence they're actually failing.
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // No body is fine - use the default threshold.
  }

  const { threshold } = (body || {}) as { threshold?: unknown };
  const cutoff = typeof threshold === 'number' && threshold > 0 && threshold <= 1 ? threshold : 0.2;

  const [catalog, stats] = await Promise.all([getCatalog({ includeBlocked: true }), getModelStats()]);
  const statById = new Map(stats.map((s) => [s.id, s]));

  const toHide = catalog.models
    .filter((m) => {
      const s = statById.get(m.id);
      return s && s.avail !== null && s.avail < cutoff;
    })
    .map((m) => m.id);

  if (toHide.length === 0) {
    return NextResponse.json({ ok: true, hidden: [], count: 0 });
  }

  const blocked = await kvGetCached('blocked_models');
  const blockedSet = new Set(blocked.map((b) => b.toLowerCase()));
  const next = [...blocked];
  for (const id of toHide) {
    if (!blockedSet.has(id.toLowerCase())) {
      next.push(id);
      blockedSet.add(id.toLowerCase());
    }
  }

  const ok = await kvSet('blocked_models', next);
  if (!ok) {
    return NextResponse.json(
      { error: 'KV storage not configured for this deployment' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, hidden: toHide, count: toHide.length });
}
