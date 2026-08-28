import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { getThread, markThreadAdminRead, adminReply } from '@/lib/messages';

export const runtime = 'nodejs';

type Params = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');
  const { userId } = await params;
  const thread = await getThread(userId);
  if (!thread) return jsonError(404, 'No thread');
  await markThreadAdminRead(userId);
  return jsonOk({ thread });
}

export async function POST(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');
  const { userId } = await params;
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  if (!text) return jsonError(400, 'Message cannot be empty');
  const thread = await adminReply(userId, text);
  if (!thread) return jsonError(404, 'No thread');
  return jsonOk({ ok: true, thread });
}
