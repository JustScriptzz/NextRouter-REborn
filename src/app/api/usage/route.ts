import { getSessionUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { getUserUsageSummary, isUnlimitedEmail } from '@/lib/usage';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Not signed in');
    
    const summary = await getUserUsageSummary(user.id);
    const unlimited = isUnlimitedEmail(user.email);
    return jsonOk({ usage: summary, unlimited });
  } catch (error) {
    console.error('[GET /api/usage] Error:', error);
    return jsonError(500, 'Failed to fetch usage');
  }
}