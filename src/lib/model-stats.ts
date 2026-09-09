// Serverless: in-memory ring buffers per model, mirrored to Cloudflare
// Workers KV (best-effort, fire-and-forget) so recent history survives
// isolate cold starts instead of resetting on every request. The public
// functions below keep their original synchronous signatures so none of
// the call sites elsewhere in the codebase need to change.
import { after } from 'next/server';
import { kvGetRaw, kvSetRaw, kvListRaw } from './kv';

const RING = 120;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const PROBE_BACKOFF_MS = 6 * 60 * 60 * 1000;
const STATS_KEY_PREFIX = 'stats:';
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

// Merges this isolate's local events for `id` into the persisted KV blob
// and writes the result back. Best-effort: never throws, never blocks the
// caller (scheduled via `after()` so it runs once the response is sent).
async function flushModel(id: string): Promise<void> {
  try {
    const local = statsMap()[id];
    if (!local) return;
    const raw = await kvGetRaw(STATS_KEY_PREFIX + id);
    const remote: ModelStat | null = raw ? (JSON.parse(raw) as ModelStat) : null;
    const events = dedupeAndTrim([...(remote?.events ?? []), ...local.events]);
    const merged: ModelStat = {
      events,
      updatedAt: Math.max(local.updatedAt, remote?.updatedAt ?? 0),
      probeBackoffUntil: local.probeBackoffUntil ?? remote?.probeBackoffUntil,
    };
    await kvSetRaw(STATS_KEY_PREFIX + id, JSON.stringify(merged));
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

// Reads every persisted per-model stat blob from KV and overlays this
// isolate's own not-yet-flushed local events on top, so a fresh isolate
// still sees history from every other isolate that has ever recorded a
// result, not just its own.
export async function getModelStats(): Promise<PublicModelStat[]> {
  const local = statsMap();
  const keys = await kvListRaw(STATS_KEY_PREFIX);
  const merged = new Map<string, ModelStat>();

  if (keys.length > 0) {
    const blobs = await Promise.all(keys.map((k) => kvGetRaw(k)));
    keys.forEach((key, i) => {
      const raw = blobs[i];
      if (!raw) return;
      const id = key.slice(STATS_KEY_PREFIX.length);
      try {
        merged.set(id, JSON.parse(raw) as ModelStat);
      } catch {
        // Skip a corrupted blob rather than failing the whole read.
      }
    });
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
