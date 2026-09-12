// Admin config storage backed by Vercel Blob.
// Replaces the old Cloudflare D1/KV-backed module: on Vercel there is no
// D1 binding, so isKvConfigured() always returned false and admin edits
// never persisted across requests/deploys. Vercel Blob is a real
// persistent object store (survives deploys, no server needed) and only
// needs the BLOB_READ_WRITE_TOKEN env var, which Vercel sets automatically
// once you create a Blob store in the project's Storage tab.
// Function names/signatures match the old module so nothing else needs
// to change beyond this file.
import { put, head } from '@vercel/blob';

const BLOB_KEY = 'admin-config.json';
const CACHE_TTL_MS = 15 * 1000;

let cache: { at: number; data: Record<string, string> } | null = null;

function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isKvConfigured(): boolean {
  return isBlobConfigured();
}

async function readAll(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (!isBlobConfigured()) return {};
  try {
    const info = await head(BLOB_KEY).catch(() => null);
    if (!info) {
      cache = { at: Date.now(), data: {} };
      return {};
    }
    const res = await fetch(info.url, { cache: 'no-store' });
    if (!res.ok) return cache?.data ?? {};
    const data = (await res.json()) as Record<string, string>;
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.warn('[config-store] read failed', { error: String(err) });
    return cache?.data ?? {};
  }
}

async function writeAll(data: Record<string, string>): Promise<boolean> {
  if (!isBlobConfigured()) return false;
  const delays = [0, 400, 900];
  let lastError: unknown;
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await put(BLOB_KEY, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
      cache = { at: Date.now(), data };
      return true;
    } catch (err) {
      lastError = err;
    }
  }
  console.warn('[config-store] write failed after retries', { key: 'admin-config', error: String(lastError) });
  return false;
}

async function readRaw(key: string): Promise<string | null> {
  const all = await readAll();
  return all[key] ?? null;
}

async function writeRaw(key: string, value: string): Promise<boolean> {
  const all = await readAll();
  all[key] = value;
  return writeAll(all);
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

const listCache = new Map<string, { at: number; value: string[] }>();

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
