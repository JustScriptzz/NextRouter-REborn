import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { kvGet, kvSet, kvInvalidateCache } from '@/lib/kv';
import { clearGatewayCaches, getCatalog, LIMITED_PROVIDERS, type CatalogEntry } from '@/lib/providers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');

  let extra: string[] = [];
  try {
    const body = (await req.json().catch(() => null)) as { providers?: unknown } | null;
    if (body && Array.isArray(body.providers)) {
      extra = body.providers.filter((p): p is string => typeof p === 'string');
    }
  } catch {
    /* empty body is fine */
  }

  const limited = new Set([...LIMITED_PROVIDERS, ...extra.map((p) => p.trim().toLowerCase())]);

  const catalog = await getCatalog();
  const targets: string[] = [];
  const seen = new Set<string>();
  const pipesMap = catalog.providersMap ?? new Map<string, CatalogEntry[]>();
  for (const [id, list] of pipesMap) {
    const providers = [...new Set(list.map((e) => e.provider))];
    const allLimited =
      providers.length > 0 && providers.every((p) => limited.has(p.toLowerCase()));
    if (!allLimited) continue;
    const key = id.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      targets.push(id);
    }
  }

  if (targets.length === 0) {
    return jsonOk({ ok: true, blocked: [], added: 0, total: undefined });
  }

  const current = await kvGet('blocked_models');
  const currentLower = new Set(current.map((v) => v.toLowerCase()));
  const toAdd = targets.filter((id) => !currentLower.has(id.toLowerCase()));
  const next = [...current, ...toAdd];
  await kvSet('blocked_models', next);
  kvInvalidateCache();
  clearGatewayCaches();

  return jsonOk({
    ok: true,
    blocked: toAdd,
    added: toAdd.length,
    total: next.length,
    scannedProviders: [...limited],
  });
}
