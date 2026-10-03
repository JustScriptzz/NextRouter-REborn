import { kvGetCached, kvSet } from './kv';

const STATS_KEY = 'model_stats_v2';
const RING = 120;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const PERSIST_INTERVAL_MS = 15000;

interface StatEvent {
  o: 0 | 1;
  t: number;
}

export interface ModelStat {
  events: StatEvent[];
  latSum: number;
  latN: number;
  tokSum: number;
  secSum: number;
  updatedAt: number;
  probeBackoffUntil?: number;
}

const PROBE_BACKOFF_MS = 6 * 60 * 60 * 1000;

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
    events: [],
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
  status?: number,
): void {
  if (!id) return;
  const e = entry(id);
  const now = Date.now();
  e.events.push({ o: ok ? 1 : 0, t: now });
  if (e.events.length > RING) e.events.splice(0, e.events.length - RING);
  if (status === 429) {
    e.probeBackoffUntil = now + PROBE_BACKOFF_MS;
  }
  if (ok) {
    e.latSum += Math.max(0, latencyMs);
    e.latN += 1;
    if (tokensOut && tokensOut > 0 && elapsedMs && elapsedMs > 0) {
      e.tokSum += tokensOut;
      e.secSum += elapsedMs / 1000;
    }
  }
  e.updatedAt = now;
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

export function isProbeBackedOff(id: string): boolean {
  const s = statsMap()[id];
  if (!s?.probeBackoffUntil) return false;
  if (s.probeBackoffUntil <= Date.now()) {
    delete s.probeBackoffUntil;
    return false;
  }
  return true;
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
          if (!statsMap()[id] && Array.isArray(s.events)) {
            statsMap()[id] = s;
          }
        }
      }
    } catch {
      /* no persisted stats yet */
    }
  }

  const cutoff = Date.now() - WINDOW_MS;
  return Object.entries(statsMap()).map(([id, s]) => {
    const recent = s.events.filter((e) => e.t >= cutoff);
    const okCount = recent.reduce((acc, e) => acc + e.o, 0);
    const failCount = recent.length - okCount;
    const last: boolean[] = s.events.slice(-20).map((e) => e.o === 1);
    return {
      id,
      ok: okCount,
      fail: failCount,
      avail: recent.length > 0 ? okCount / recent.length : null,
      avgLatencyMs: s.latN > 0 ? Math.round(s.latSum / s.latN) : null,
      tokPerSec: s.secSum > 0 ? Math.round((s.tokSum / s.secSum) * 10) / 10 : null,
      last,
      updatedAt: s.updatedAt || null,
    };
  });
}
