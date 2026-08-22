import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { kvGet, kvSet, kvInvalidateCache } from '@/lib/kv';
import { clearGatewayCaches } from '@/lib/providers';

export const runtime = 'nodejs';

const ALLOWED_KEYS = ['blocked_models', 'pinned_models', 'unlimited_emails', 'disabled_providers', 'banner'];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');
  const config: Record<string, string[]> = {};
  for (const key of ALLOWED_KEYS) config[key] = await kvGet(key);
  return jsonOk({ config });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');
  const body = (await req.json().catch(() => null)) as { key?: string; value?: string[] } | null;
  if (!body?.key || !ALLOWED_KEYS.includes(body.key) || !Array.isArray(body.value)) {
    return jsonError(400, 'Provide key and value array');
  }
  await kvSet(body.key, body.value.map((v) => String(v).trim()).filter(Boolean));
  kvInvalidateCache();
  clearGatewayCaches();
  return jsonOk({ ok: true });
}
