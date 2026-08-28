import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { listPendingRequests } from '@/lib/user-limits';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');
  const requests = await listPendingRequests();
  return jsonOk({ requests });
}
