import { getSessionUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { getUserUsageSummary } from '@/lib/usage';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  const summary = await getUserUsageSummary(user.id);
  return jsonOk({ usage: summary });
}