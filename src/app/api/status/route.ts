import { after } from 'next/server';
import { jsonOkCors } from '@/lib/http';
import { getModelStats } from '@/lib/model-stats';
import { probeCatalog } from '@/lib/prober';
import { getCatalog } from '@/lib/providers';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const PROBE_STALE_MS = 10 * 60 * 1000;

const globalForProbe = globalThis as unknown as {
  __statusLastProbeAt?: number;
  __statusProbeRunning?: boolean;
};

export async function GET() {
  const [stats, catalog] = await Promise.all([getModelStats(), getCatalog()]);

  const last = globalForProbe.__statusLastProbeAt ?? 0;
  const stale = Date.now() - last > PROBE_STALE_MS;
  if (stale && !globalForProbe.__statusProbeRunning) {
    globalForProbe.__statusProbeRunning = true;
    globalForProbe.__statusLastProbeAt = Date.now();
    after(async () => {
      try {
        await probeCatalog();
      } catch {
        /* probe failures don't affect the response */
      } finally {
        globalForProbe.__statusProbeRunning = false;
      }
    });
  }

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
      free: id.includes(':free') || id.includes('kilo-auto') || id.endsWith('/free'),
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
