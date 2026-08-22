import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { clearGatewayCaches } from '@/lib/providers';

export const runtime = 'nodejs';

export async function POST() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');
  clearGatewayCaches();
  return jsonOk({ ok: true });
}
