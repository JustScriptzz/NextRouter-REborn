// Serverless config store backed by Cloudflare Workers KV (binding
// `CONFIG_KV`), with environment variables as the initial/fallback
// defaults. Env vars seed the config; once an admin edits a key through
// the admin panel, the KV value takes over for that key at runtime -
// no redeploy needed.
import { getRequestContext } from '@cloudflare/next-on-pages';

// Minimal shape of a Workers KV binding - avoids depending on
// @cloudflare/workers-types just for this one interface.
interface MinimalKVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

const ENV_FOR_KEY: Record<string, string> = {
  disabled_providers: 'DISABLED_PROVIDERS',
  blocked_models: 'BLOCKED_MODELS',
  pinned_models: 'PINNED_MODELS',
  model_rules: 'MODEL_RULES',
  extra_gateways: 'EXTRA_GATEWAYS',
  banner: 'PUBLIC_BANNER',
  blocked_email_domains: 'BLOCKED_EMAIL_DOMAINS',
};

const KV_KEY_PREFIX = 'config:';

function splitList(raw: string, key: string): string[] {
  // Rule-style values (MODEL_RULES, EXTRA_GATEWAYS) contain commas inside
  // individual rules, so they split on newlines / `;;`. Plain id lists
  // split on commas.
  const ruleStyle = key === 'model_rules' || key === 'extra_gateways';
  const parts = ruleStyle ? raw.split(/(?:\r?\n)+|;;/) : raw.split(',');
  return parts.map((p) => p.trim()).filter(Boolean);
}

// `getRequestContext()` uses AsyncLocalStorage-style context propagation
// that can occasionally be lost across `await` boundaries under
// concurrent traffic in the same isolate, making it throw even though a
// binding genuinely exists. Once we've successfully resolved the binding
// once in this isolate, we cache the object itself (bindings never change
// for a given deployment) and never call getRequestContext() again here -
// which also sidesteps the race for every call after the first.
const globalForKv = globalThis as unknown as {
  __kvBinding?: MinimalKVNamespace | null;
  __kvBindingReady?: boolean;
};

function getKvBinding(): MinimalKVNamespace | null {
  if (globalForKv.__kvBindingReady) return globalForKv.__kvBinding ?? null;
  try {
    const env = getRequestContext().env as { CONFIG_KV?: MinimalKVNamespace };
    globalForKv.__kvBinding = env.CONFIG_KV ?? null;
  } catch {
    // No request context available (e.g. mid-build, or a transient async-
    // context race). Don't cache a failure - retry on the next call.
    return null;
  }
  if (globalForKv.__kvBinding) {
    globalForKv.__kvBindingReady = true;
  }
  return globalForKv.__kvBinding;
}

async function envDefault(key: string): Promise<string[]> {
  const envName = ENV_FOR_KEY[key];
  if (!envName) return [];
  return splitList(process.env[envName] ?? '', key);
}

// Short-lived in-memory cache so a burst of requests in the same isolate
// doesn't hit KV on every call, while still picking up admin edits quickly.
const CACHE_TTL_MS = 15 * 1000;
const cache = new Map<string, { at: number; value: string[] }>();

export async function kvGet(key: string): Promise<string[]> {
  const kv = getKvBinding();
  if (!kv) return envDefault(key);

  try {
    const raw = await kv.get(KV_KEY_PREFIX + key);
    if (raw === null) return envDefault(key);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : envDefault(key);
  } catch {
    return envDefault(key);
  }
}

export async function kvGetCached(key: string): Promise<string[]> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await kvGet(key);
  cache.set(key, { at: now, value });
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cloudflare KV limits writes to the same key to roughly once per second.
// A quick double-tap or a couple of admin edits landing close together is
// enough to hit that, so retry a few times with backoff before giving up -
// this alone resolves the vast majority of "write failed" cases.
async function putWithRetry(
  kv: MinimalKVNamespace,
  key: string,
  value: string,
): Promise<boolean> {
  const maxAttempts = 6;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter: spreads out concurrent writers to
      // the same key instead of having them all retry in lockstep and
      // collide again on every attempt.
      const base = Math.min(300 * 2 ** (attempt - 1), 2000);
      await sleep(base / 2 + Math.random() * (base / 2));
    }
    try {
      await kv.put(key, value);
      return true;
    } catch (err) {
      lastError = err;
    }
  }
  console.warn('[kv] put failed after retries', { key, error: String(lastError) });
  return false;
}

export async function kvSet(key: string, values: string[]): Promise<boolean> {
  const kv = getKvBinding();
  if (!kv) return false;
  const ok = await putWithRetry(kv, KV_KEY_PREFIX + key, JSON.stringify(values));
  if (ok) cache.set(key, { at: Date.now(), value: values });
  return ok;
}

export function isKvConfigured(): boolean {
  return getKvBinding() !== null;
}

// Raw single-key helpers (no list/JSON-array semantics, no env fallback,
// no in-memory cache) - used for data that isn't a simple admin-editable
// list, like per-model stats blobs.
export async function kvGetRaw(key: string): Promise<string | null> {
  const kv = getKvBinding();
  if (!kv) return null;
  try {
    return await kv.get(key);
  } catch {
    return null;
  }
}

export async function kvSetRaw(key: string, value: string): Promise<boolean> {
  const kv = getKvBinding();
  if (!kv) return false;
  return putWithRetry(kv, key, value);
}

export async function kvListRaw(prefix: string): Promise<string[]> {
  const kv = getKvBinding();
  if (!kv) return [];
  try {
    const result = await kv.list({ prefix });
    return result.keys.map((k) => k.name);
  } catch {
    return [];
  }
}
