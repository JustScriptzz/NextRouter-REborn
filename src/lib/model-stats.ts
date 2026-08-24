import { kvGetCached, kvSet } from './kv';

const STATS_KEY = 'model_stats';
const RING = 20;
const PERSIST_INTERVAL_MS = 15000;

export interface ModelStat {
  ok: number;
  fail: number;
  last: boolean[];
  latSum: number;
  latN: number;
  tokSum: number;
  secSum: number;
  updatedAt: number;
}

type StatsMap = Record<string, ModelStat>;

const globalForStats = globalThis as unknown as {
  __modelStats?: StatsMap;
  __modelStatsPersistedAt?: number;
  __modelStatsPersisting?: boolean;
};

function statsMap(): StatsMap {
  return (globalForStats.__modelStats ??= {});
}

function entry(id: string): ModelStat {
  const m = statsMap();
  return (m[id] ??= {
    ok: 0,
    fail: 0,
    last: [],
    latSum: 0,
    latN: 0,
    tokSum: 0,
    secSum: 0,
    updatedAt: 0,
  });
}

export function recordModelResult(
  id: string,
  ok: boolean,
  latencyMs: number,
  tokensOut?: number,
  elapsedMs?: number,
): void {
  if (!id) return;
  const e = entry(id);
  if (ok) e.ok += 1;
  else e.fail += 1;
  e.last.push(ok);
  if (e.last.length > RING) e.last.shift();
  if (ok) {
    e.latSum += Math.max(0, latencyMs);
    e.latN += 1;
    if (tokensOut && tokensOut > 0 && elapsedMs && elapsedMs > 0) {
      e.tokSum += tokensOut;
      e.secSum += elapsedMs / 1000;
    }
  }
  e.updatedAt = Date.now();
  maybePersist();
}

function maybePersist(): void {
  const now = Date.now();
  if (globalForStats.__modelStatsPersisting) return;
  if (now - (globalForStats.__modelStatsPersistedAt ?? 0) < PERSIST_INTERVAL_MS) return;
  globalForStats.__modelStatsPersisting = true;
  globalForStats.__modelStatsPersistedAt = now;
  const snapshot = JSON.stringify(statsMap());
  void kvSet(STATS_KEY, [snapshot])
    .catch(() => undefined)
    .finally(() => {
      globalForStats.__modelStatsPersisting = false;
    });
}

export interface PublicModelStat {
  id: string;
  ok: number;
  fail: number;
  avail: number | null;
  avgLatencyMs: number | null;
  tokPerSec: number | null;
  last: boolean[];
  updatedAt: number | null;
}

export async function getModelStats(): Promise<PublicModelStat[]> {
  if (Object.keys(statsMap()).length === 0) {
    try {
      const stored = await kvGetCached(STATS_KEY);
      if (stored && stored[0]) {
        const parsed = JSON.parse(stored[0]) as StatsMap;
        for (const [id, s] of Object.entries(parsed)) {
          if (!statsMap()[id]) statsMap()[id] = s;
        }
      }
    } catch {
      /* no persisted stats yet */
    }
  }
  return Object.entries(statsMap()).map(([id, s]) => ({
    id,
    ok: s.ok,
    fail: s.fail,
    avail: s.ok + s.fail > 0 ? s.ok / (s.ok + s.fail) : null,
    avgLatencyMs: s.latN > 0 ? Math.round(s.latSum / s.latN) : null,
    tokPerSec: s.secSum > 0 ? Math.round((s.tokSum / s.secSum) * 10) / 10 : null,
    last: [...s.last],
    updatedAt: s.updatedAt || null,
  }));
}
