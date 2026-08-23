import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { kvGet, kvSet, kvInvalidateCache } from '@/lib/kv';
import { clearGatewayCaches, getCatalog } from '@/lib/providers';

export const runtime = 'nodejs';

export async function POST() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');

  const catalog = await getCatalog();
  const aquadevsOnly = catalog.models.filter((m) => m.provider === 'aquadevs').map((m) => m.id);

  if (aquadevsOnly.length === 0) {
    return jsonOk({ ok: true, blocked: [], added: 0 });
  }

  const current = await kvGet('blocked_models');
  const currentLower = new Set(current.map((v) => v.toLowerCase()));
  const toAdd = aquadevsOnly.filter((id) => !currentLower.has(id.toLowerCase()));
  const next = [...current, ...toAdd];
  await kvSet('blocked_models', next);
  kvInvalidateCache();
  clearGatewayCaches();

  return jsonOk({ ok: true, blocked: toAdd, added: toAdd.length, total: next.length });
}
