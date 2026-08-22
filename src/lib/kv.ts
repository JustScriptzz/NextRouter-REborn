import { sql } from 'drizzle-orm';
import { db } from './db/client';

let ensured = false;

async function ensureTable(): Promise<void> {
  if (ensured) return;
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS app_config (key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '[]'::jsonb)`,
  );
  ensured = true;
}

export async function kvGet(key: string): Promise<string[]> {
  await ensureTable();
  const res = (await db.execute(
    sql`SELECT value FROM app_config WHERE key = ${key}`,
  )) as unknown as { rows?: Array<{ value: unknown }> } | Array<{ value: unknown }>;
  const rows = Array.isArray(res) ? res : res.rows ?? [];
  const first = rows[0]?.value;
  if (Array.isArray(first)) return first.filter((v): v is string => typeof v === 'string');
  return [];
}

export async function kvSet(key: string, value: string[]): Promise<void> {
  await ensureTable();
  await db.execute(
    sql`INSERT INTO app_config (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}::jsonb`,
  );
}

let cacheAt = 0;
const cacheMap = new Map<string, string[]>();

export async function kvGetCached(key: string): Promise<string[]> {
  if (Date.now() - cacheAt < 20000 && cacheMap.has(key)) {
    return cacheMap.get(key) ?? [];
  }
  const value = await kvGet(key);
  cacheMap.set(key, value);
  cacheAt = Date.now();
  return value;
}

export function kvInvalidateCache(): void {
  cacheMap.clear();
  cacheAt = 0;
}
