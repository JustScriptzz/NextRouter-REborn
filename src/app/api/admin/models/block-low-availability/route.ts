import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { kvGet, kvSet, kvInvalidateCache } from '@/lib/kv';
import { clearGatewayCaches, getCatalog } from '@/lib/providers';
import { getModelStats } from '@/lib/model-stats';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');

  let threshold = 0.20;
  try {
    const body = (await req.json().catch(() => null)) as { threshold?: unknown } | null;
    if (body?.threshold !== undefined) threshold = Number(body.threshold);
  } catch { /* fine */ }

  const catalog = await getCatalog();
  const statsArr = await getModelStats();
  const statsMap = new Map(statsArr.map((s) => [s.id, s]));

  const targets: string[] = [];
  const seen = new Set<string>();
  for (const id of catalog.byId.keys()) {
    const s = statsMap.get(id);
    if (!s || s.updatedAt === null) continue;
    const avail = s.avail;
    if (avail === null || avail >= threshold) continue;
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
    threshold,
    blocked: toAdd,
    added: toAdd.length,
    total: next.length,
  });
}
