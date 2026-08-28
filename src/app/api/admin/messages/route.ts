import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { listThreads, markThreadAdminRead, unreadForAdmin } from '@/lib/messages';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');
  const threads = await listThreads();
  return jsonOk({
    threads: threads.map((t) => ({
      userId: t.userId,
      username: t.username,
      email: t.email,
      updatedAt: t.updatedAt,
      unread: unreadForAdmin(t),
      preview: t.messages[t.messages.length - 1]?.text ?? '',
    })),
  });
}
