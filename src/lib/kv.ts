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

function getKvBinding(): MinimalKVNamespace | null {
  try {
    const env = getRequestContext().env as { CONFIG_KV?: MinimalKVNamespace };
    return env.CONFIG_KV ?? null;
  } catch {
    // No request context available (e.g. during build) - fall back to env.
    return null;
  }
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

export async function kvSet(key: string, values: string[]): Promise<boolean> {
  const kv = getKvBinding();
  if (!kv) return false;
  try {
    await kv.put(KV_KEY_PREFIX + key, JSON.stringify(values));
    cache.set(key, { at: Date.now(), value: values });
    return true;
  } catch {
    return false;
  }
}

export function isKvConfigured(): boolean {
  return getKvBinding() !== null;
}
