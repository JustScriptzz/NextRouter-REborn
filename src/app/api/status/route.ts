import { jsonOkCors } from '@/lib/http';
import { getModelStats } from '@/lib/model-stats';
import { getCatalog } from '@/lib/providers';

export const runtime = 'edge';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET() {
  // NOTE: this endpoint never triggers probing. It used to kick off a full
  // probeCatalog() sweep when stale, which meant every status-page view (the
  // UI polls every 10s) fanned out into hundreds of live completions and
  // throttled the upstreams it was measuring. Probing now happens only via
  // the secret/cron /api/status/probe route.
  const [stats, catalog] = await Promise.all([getModelStats(), getCatalog()]);

  const rows = new Map<
    string,
    {
      id: string;
      type: string | null;
      providers: string[];
      free: boolean;
      ok: number;
      fail: number;
      avail: number | null;
      avgLatencyMs: number | null;
      tokPerSec: number | null;
      last: boolean[];
      updatedAt: number | null;
    }
  >();

  for (const [id, entry] of catalog.byId) {
    const providers = [...new Set((catalog.providersMap?.get(id) ?? []).map((p) => p.provider))];
    rows.set(id, {
      id,
      type: entry.type,
      providers,
      free: id.includes(':free') || id.endsWith('/free'),
      ok: 0,
      fail: 0,
      avail: null,
      avgLatencyMs: null,
      tokPerSec: null,
      last: [],
      updatedAt: null,
    });
  }

  for (const s of stats) {
    const existing = rows.get(s.id);
    if (!existing) continue;
    existing.ok = s.ok;
    existing.fail = s.fail;
    existing.avail = s.avail;
    existing.avgLatencyMs = s.avgLatencyMs;
    existing.tokPerSec = s.tokPerSec;
    existing.last = s.last;
    existing.updatedAt = s.updatedAt;
  }

  const models = [...rows.values()].sort((a, b) => {
    const aData = a.updatedAt ?? 0;
    const bData = b.updatedAt ?? 0;
    if ((aData > 0) !== (bData > 0)) return bData > 0 ? 1 : -1;
    if (aData !== bData) return bData - aData;
    return a.id.localeCompare(b.id);
  });

  return jsonOkCors({ models, updatedAt: Date.now() }, 200);
}
