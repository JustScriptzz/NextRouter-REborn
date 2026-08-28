import { getSessionUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { getUnreadCountForUser } from '@/lib/messages';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  const unread = await getUnreadCountForUser(user.id);
  return jsonOk({ unread });
}