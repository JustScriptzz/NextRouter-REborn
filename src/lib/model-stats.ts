// Serverless: in-memory ring buffers per model, mirrored to Cloudflare
// Workers KV as ONE combined blob (not one key per model - the free plan
// caps KV writes at 1,000/day, and this project tracks hundreds of
// models, so a per-model write on every recorded result would burn the
// whole daily quota in a single probe cycle). All isolates share one
// throttle window for the flush, so writes stay rare regardless of how
// many models are active. Public function signatures are unchanged so no
// call site elsewhere in the codebase needs to change.
import { after } from 'next/server';
import { kvGetRaw, kvSetRaw } from './kv';

const RING = 120;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const PROBE_BACKOFF_MS = 6 * 60 * 60 * 1000;
const STATS_BLOB_KEY = 'model_stats_blob';
// Conservative: keeps this well under the free 1,000 writes/day KV quota
// even with several isolates flushing independently.
const MIN_FLUSH_INTERVAL_MS = 5 * 60 * 1000;

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
  __modelStatsDirty?: boolean;
  __modelStatsLastFlush?: number;
  __modelStatsFlushing?: Promise<void>;
};

function statsMap(): StatsMap {
  return (globalForStats.__modelStats ??= {});
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

// Merges every model this isolate has touched into the persisted blob and
// writes it back in a SINGLE KV put, regardless of how many models
// changed. Best-effort: never throws, never blocks the caller.
async function flushAll(): Promise<void> {
  try {
    const local = statsMap();
    if (Object.keys(local).length === 0) return;
    const raw = await kvGetRaw(STATS_BLOB_KEY);
    const remote: StatsMap = raw ? (JSON.parse(raw) as StatsMap) : {};
    const merged: StatsMap = { ...remote };
    for (const [id, s] of Object.entries(local)) {
      const r = merged[id];
      merged[id] = r
        ? {
            events: dedupeAndTrim([...r.events, ...s.events]),
            updatedAt: Math.max(r.updatedAt, s.updatedAt),
            probeBackoffUntil: s.probeBackoffUntil ?? r.probeBackoffUntil,
          }
        : s;
    }
    await kvSetRaw(STATS_BLOB_KEY, JSON.stringify(merged));
  } catch {
    // Best-effort persistence only - a failed flush just delays the next one.
  }
}

function scheduleFlush(): void {
  globalForStats.__modelStatsDirty = true;
  const last = globalForStats.__modelStatsLastFlush ?? 0;
  if (Date.now() - last < MIN_FLUSH_INTERVAL_MS) return;
  globalForStats.__modelStatsLastFlush = Date.now();
  const run = async () => {
    await flushAll();
    globalForStats.__modelStatsDirty = false;
  };
  try {
    after(run);
  } catch {
    // `after()` needs an active request context; outside of one, just
    // fire-and-forget instead of failing the caller.
    void run();
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
  scheduleFlush();
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

// Reads the single persisted stats blob from KV and overlays this
// isolate's own not-yet-flushed local events on top, so a fresh isolate
// still sees history from every other isolate that has ever flushed.
export async function getModelStats(): Promise<PublicModelStat[]> {
  const local = statsMap();
  const raw = await kvGetRaw(STATS_BLOB_KEY);
  const remote: StatsMap = raw ? (JSON.parse(raw) as StatsMap) : {};
  const merged = new Map<string, ModelStat>(Object.entries(remote));

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
