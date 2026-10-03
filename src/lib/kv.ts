import { sql } from 'drizzle-orm';
import { db } from './db/client';

// No DATABASE_URL = no database at all. Every KV read returns its default
// and every write is a silent no-op, with zero connection attempts and zero
// log spam. Without a database, keys resolve via demo key, SYSTEM_TEST_KEY,
// or the external validator (BOT_VALIDATOR_URL) when configured.
const DB_ON = (process.env.DATABASE_URL ?? '') !== '';

let ensured = false;
let attemptedEnsure = false;

async function ensureTable(): Promise<void> {
  if (ensured) return;
  if (attemptedEnsure) return; // Avoid retry loop if already tried
  
  attemptedEnsure = true;
  try {
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS app_config (key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '[]'::jsonb)`,
    );
    ensured = true;
  } catch (error) {
    console.error('[KV] Failed to ensure table:', error);
    // Don't re-throw - let caller handle it
  }
}

export async function kvGet(key: string): Promise<string[]> {
  if (!DB_ON) return [];
  try {
    await ensureTable();
    const res = (await db.execute(
      sql`SELECT value FROM app_config WHERE key = ${key}`,
    )) as unknown as { rows?: Array<{ value: unknown }> } | Array<{ value: unknown }>;
    const rows = Array.isArray(res) ? res : res.rows ?? [];
    const first = rows[0]?.value;
    if (Array.isArray(first)) return first.filter((v): v is string => typeof v === 'string');
    return [];
  } catch (error) {
    console.error(`[KV] Failed to get key "${key}":`, error);
    return [];
  }
}

export async function kvSet(key: string, value: string[]): Promise<void> {
  if (!DB_ON) return;
  try {
    await ensureTable();
    await db.execute(
      sql`INSERT INTO app_config (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb)
          ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}::jsonb`,
    );
  } catch (error) {
    console.error(`[KV] Failed to set key "${key}":`, error);
    // Don't re-throw - silently fail
  }
}

let cacheAt = 0;
const cacheMap = new Map<string, string[]>();

export async function kvGetCached(key: string): Promise<string[]> {
  try {
    if (Date.now() - cacheAt < 20000 && cacheMap.has(key)) {
      return cacheMap.get(key) ?? [];
    }
    const value = await kvGet(key);
    cacheMap.set(key, value);
    cacheAt = Date.now();
    return value;
  } catch (error) {
    console.error(`[KV] Failed to get cached key "${key}":`, error);
    return [];
  }
}

export function kvInvalidateCache(): void {
  cacheMap.clear();
  cacheAt = 0;
}