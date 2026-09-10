// Admin config storage backed by Cloudflare D1 (SQLite) instead of
// Workers KV: D1\'s free tier allows far more writes/day, and this is
// the same D1 database already used for model stats (one binding, two
// tables). Function names match the old KV-backed module so nothing
// else needed to change beyond the import path.
import { getRequestContext } from '@cloudflare/next-on-pages';

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

// Same async-context-race guard used elsewhere: cache the binding after
// the first successful resolve so later calls (which may happen after
// other `await`s) never need to call getRequestContext() again.
const globalForDb = globalThis as unknown as {
  __configDb?: MinimalD1Database | null;
  __configDbReady?: boolean;
};

function getDb(): MinimalD1Database | null {
  if (globalForDb.__configDbReady) return globalForDb.__configDb ?? null;
  try {
    const env = getRequestContext().env as { STATS_DB?: MinimalD1Database };
    globalForDb.__configDb = env.STATS_DB ?? null;
  } catch {
    return null;
  }
  if (globalForDb.__configDb) globalForDb.__configDbReady = true;
  return globalForDb.__configDb;
}

export function isKvConfigured(): boolean {
  return getDb() !== null;
}

// Short-lived in-memory cache so a burst of requests in the same isolate
// doesn't hit D1 on every call, while still picking up admin edits quickly.
const CACHE_TTL_MS = 15 * 1000;
const listCache = new Map<string, { at: number; value: string[] }>();

async function readRaw(key: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const row = await db
      .prepare('SELECT value FROM admin_config WHERE key = ?')
      .bind(key)
      .first<{ value: string }>();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function writeRaw(key: string, value: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const delays = [0, 400, 900];
  let lastError: unknown;
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await db
        .prepare(
          `INSERT INTO admin_config (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .bind(key, value)
        .run();
      return true;
    } catch (err) {
      lastError = err;
    }
  }
  console.warn('[config-store] write failed after retries', { key, error: String(lastError) });
  return false;
}

// List-style config (admin-editable lists: blocked_models, model_rules,
// extra_gateways, etc.) - stored as a JSON array string.
export async function kvGet(key: string): Promise<string[]> {
  const raw = await readRaw(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function kvGetCached(key: string): Promise<string[]> {
  const hit = listCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await kvGet(key);
  listCache.set(key, { at: now, value });
  return value;
}

export async function kvSet(key: string, values: string[]): Promise<boolean> {
  const ok = await writeRaw(key, JSON.stringify(values));
  if (ok) listCache.set(key, { at: Date.now(), value: values });
  return ok;
}

// Raw single-value config (not a list) - e.g. the per-model system prompt
// map, stored as a JSON object string.
export async function kvGetRaw(key: string): Promise<string | null> {
  return readRaw(key);
}

export async function kvSetRaw(key: string, value: string): Promise<boolean> {
  return writeRaw(key, value);
}
