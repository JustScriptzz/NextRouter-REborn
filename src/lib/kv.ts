// Serverless config store. The Postgres-backed app_config KV is gone; the
// handful of live config keys are plain environment variables now (same
// string-list shape the old KV rows carried). kvGet/kvGetCached keep their
// signatures so all consumers work unchanged. There is no kvSet — config
// changes are redeploys.
const ENV_FOR_KEY: Record<string, string> = {
  disabled_providers: 'DISABLED_PROVIDERS',
  blocked_models: 'BLOCKED_MODELS',
  pinned_models: 'PINNED_MODELS',
  model_rules: 'MODEL_RULES',
  extra_gateways: 'EXTRA_GATEWAYS',
  banner: 'PUBLIC_BANNER',
  blocked_email_domains: 'BLOCKED_EMAIL_DOMAINS',
};

function splitList(raw: string, key: string): string[] {
  // Rule-style values (MODEL_RULES, EXTRA_GATEWAYS) contain commas inside
  // individual rules, so they split on newlines / `;;`. Plain id lists
  // split on commas.
  const ruleStyle = key === 'model_rules' || key === 'extra_gateways';
  const parts = ruleStyle ? raw.split(/(?:\r?\n)+|;;/) : raw.split(',');
  return parts.map((p) => p.trim()).filter(Boolean);
}

export async function kvGet(key: string): Promise<string[]> {
  const envName = ENV_FOR_KEY[key];
  if (!envName) return [];
  return splitList(process.env[envName] ?? '', key);
}

// Env never changes at runtime, so cache forever (no TTL needed).
const cacheMap = new Map<string, string[]>();

export async function kvGetCached(key: string): Promise<string[]> {
  const hit = cacheMap.get(key);
  if (hit) return hit;
  const value = await kvGet(key);
  cacheMap.set(key, value);
  return value;
}
