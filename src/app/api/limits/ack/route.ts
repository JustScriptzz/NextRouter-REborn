import { getSessionUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { clearDecision, getDecision } from '@/lib/user-limits';

export const runtime = 'nodejs';

export async function POST() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  await clearDecision(user.id);
  return jsonOk({ ok: true });
}
