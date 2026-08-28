import { getSessionUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import {
  getThread,
  markThreadRead,
  sendUserMessage,
  unreadForUser,
} from '@/lib/messages';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  const thread = await getThread(user.id);
  await markThreadRead(user.id);
  return jsonOk({
    messages: thread?.messages ?? [],
    unread: thread ? unreadForUser(thread) : 0,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  if (!text) return jsonError(400, 'Message cannot be empty');
  const thread = await sendUserMessage(user.id, user.username, user.email, text);
  return jsonOk({ ok: true, messages: thread.messages }, 201);
}