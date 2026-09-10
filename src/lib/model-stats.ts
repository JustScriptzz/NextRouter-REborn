// Serverless: in-memory ring buffers per model, persisted to Cloudflare
// D1 (SQLite) instead of Workers KV - D1's free tier allows 100,000 row
// writes/day vs KV's 1,000/day, which matters here since this project
// tracks hundreds of models and writes on every recorded result.
import { after } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

const RING = 120;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const PROBE_BACKOFF_MS = 6 * 60 * 60 * 1000;
const MIN_FLUSH_INTERVAL_MS = 5 * 1000;

interface StatEvent {
  o: 0 | 1;
  t: number;
  lat?: number;
  tok?: number;
  sec?: number;
}

export interface ModelStat {
  events: StatEvent[];
  updatedAt: number;
  probeBackoffUntil?: number;
}

type StatsMap = Record<string, ModelStat>;

// Minimal D1 binding shape - avoids depending on @cloudflare/workers-types
// just for this one interface.
interface D1Result<T = unknown> {
  results: T[];
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
}
interface MinimalD1Database {
  prepare(query: string): D1PreparedStatement;
}

// Same async-context-race guard as kv.ts: cache the binding after the
// first successful resolve so later calls (which may happen after other
// `await`s) never need to call getRequestContext() again.
const globalForD1 = globalThis as unknown as {
  __statsDb?: MinimalD1Database | null;
  __statsDbReady?: boolean;
};

function getDb(): MinimalD1Database | null {
  if (globalForD1.__statsDbReady) return globalForD1.__statsDb ?? null;
  try {
    const env = getRequestContext().env as { STATS_DB?: MinimalD1Database };
    globalForD1.__statsDb = env.STATS_DB ?? null;
  } catch {
    return null;
  }
  if (globalForD1.__statsDb) globalForD1.__statsDbReady = true;
  return globalForD1.__statsDb;
}

const globalForStats = globalThis as unknown as {
  __modelStats?: StatsMap;
  __modelStatsLastFlush?: Record<string, number>;
};

function statsMap(): StatsMap {
  return (globalForStats.__modelStats ??= {});
}

function lastFlushMap(): Record<string, number> {
  return (globalForStats.__modelStatsLastFlush ??= {});
}

function entry(id: string): ModelStat {
  const m = statsMap();
  return (m[id] ??= { events: [], updatedAt: 0 });
}

function dedupeAndTrim(events: StatEvent[]): StatEvent[] {
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    const key = `${e.t}:${e.o}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.t - b.t);
  return unique.slice(-RING);
}

// Merges this isolate's local events for `id` into the persisted D1 row
// and writes it back with a single UPSERT. Best-effort: never throws,
// never blocks the caller (scheduled via `after()`).
async function flushModel(id: string): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    const local = statsMap()[id];
    if (!local) return;

    const row = await db
      .prepare('SELECT events, updated_at, probe_backoff_until FROM model_stats WHERE id = ?')
      .bind(id)
      .first<{ events: string; updated_at: number; probe_backoff_until: number | null }>();

    const remoteEvents: StatEvent[] = row ? (JSON.parse(row.events) as StatEvent[]) : [];
    const events = dedupeAndTrim([...remoteEvents, ...local.events]);
    const updatedAt = Math.max(local.updatedAt, row?.updated_at ?? 0);
    const probeBackoffUntil = local.probeBackoffUntil ?? row?.probe_backoff_until ?? null;

    await db
      .prepare(
        `INSERT INTO model_stats (id, events, updated_at, probe_backoff_until)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           events = excluded.events,
           updated_at = excluded.updated_at,
           probe_backoff_until = excluded.probe_backoff_until`,
      )
      .bind(id, JSON.stringify(events), updatedAt, probeBackoffUntil)
      .run();
  } catch {
    // Best-effort persistence only - a failed flush just delays the next one.
  }
}

function scheduleFlush(id: string): void {
  const last = lastFlushMap()[id] ?? 0;
  if (Date.now() - last < MIN_FLUSH_INTERVAL_MS) return;
  lastFlushMap()[id] = Date.now();
  try {
    after(() => flushModel(id));
  } catch {
    // `after()` needs an active request context; outside of one, just
    // fire-and-forget instead of failing the caller.
    void flushModel(id);
  }
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
  const ev: StatEvent = { o: ok ? 1 : 0, t: now };
  if (ok) {
    ev.lat = Math.max(0, latencyMs);
    if (tokensOut && tokensOut > 0 && elapsedMs && elapsedMs > 0) {
      ev.tok = tokensOut;
      ev.sec = elapsedMs / 1000;
    }
  }
  e.events.push(ev);
  if (e.events.length > RING) e.events.splice(0, e.events.length - RING);
  if (status === 429) {
    e.probeBackoffUntil = now + PROBE_BACKOFF_MS;
  }
  e.updatedAt = now;
  scheduleFlush(id);
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

function summarize(id: string, s: ModelStat): PublicModelStat {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = s.events.filter((e) => e.t >= cutoff);
  const okCount = recent.reduce((acc, e) => acc + e.o, 0);
  const failCount = recent.length - okCount;
  const last: boolean[] = s.events.slice(-20).map((e) => e.o === 1);

  let latSum = 0;
  let latN = 0;
  let tokSum = 0;
  let secSum = 0;
  for (const e of recent) {
    if (e.o === 1 && typeof e.lat === 'number') {
      latSum += e.lat;
      latN += 1;
    }
    if (e.tok && e.sec) {
      tokSum += e.tok;
      secSum += e.sec;
    }
  }

  return {
    id,
    ok: okCount,
    fail: failCount,
    avail: recent.length > 0 ? okCount / recent.length : null,
    avgLatencyMs: latN > 0 ? Math.round(latSum / latN) : null,
    tokPerSec: secSum > 0 ? Math.round((tokSum / secSum) * 10) / 10 : null,
    last,
    updatedAt: s.updatedAt || null,
  };
}

// Reads every persisted per-model row from D1 and overlays this isolate's
// own not-yet-flushed local events on top, so a fresh isolate still sees
// history from every other isolate that has ever recorded a result.
export async function getModelStats(): Promise<PublicModelStat[]> {
  const local = statsMap();
  const merged = new Map<string, ModelStat>();

  const db = getDb();
  if (db) {
    try {
      const { results } = await db
        .prepare('SELECT id, events, updated_at, probe_backoff_until FROM model_stats')
        .all<{ id: string; events: string; updated_at: number; probe_backoff_until: number | null }>();
      for (const row of results) {
        try {
          merged.set(row.id, {
            events: JSON.parse(row.events) as StatEvent[],
            updatedAt: row.updated_at,
            probeBackoffUntil: row.probe_backoff_until ?? undefined,
          });
        } catch {
          // Skip a corrupted row rather than failing the whole read.
        }
      }
    } catch {
      // Best-effort: fall back to local-only data if D1 is unavailable.
    }
  }

  for (const [id, s] of Object.entries(local)) {
    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, s);
      continue;
    }
    merged.set(id, {
      events: dedupeAndTrim([...existing.events, ...s.events]),
      updatedAt: Math.max(existing.updatedAt, s.updatedAt),
      probeBackoffUntil: s.probeBackoffUntil ?? existing.probeBackoffUntil,
    });
  }

  return [...merged.entries()].map(([id, s]) => summarize(id, s));
}
