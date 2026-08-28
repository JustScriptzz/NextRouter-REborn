import { kvGet, kvSet, kvInvalidateCache } from './kv';

export interface ChatMessage {
  id: string;
  role: 'user' | 'admin';
  text: string;
  at: number;
}

export interface MessageThread {
  userId: string;
  username: string;
  email: string;
  messages: ChatMessage[];
  userReadAt: number;
  adminReadAt: number;
  updatedAt: number;
}

const THREADS_KEY = 'message_threads_map';

function genId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readThreads(): Promise<Record<string, MessageThread>> {
  try {
    const rows = await kvGet(THREADS_KEY);
    if (rows && rows[0]) {
      const parsed = JSON.parse(rows[0]) as { v: Record<string, MessageThread>; ts: number };
      if (parsed && parsed.v && typeof parsed.v === 'object') return parsed.v;
    }
  } catch {
    /* none yet */
  }
  return {};
}

async function writeThreads(map: Record<string, MessageThread>): Promise<void> {
  await kvSet(THREADS_KEY, [JSON.stringify({ v: map, ts: Date.now() })]);
  kvInvalidateCache();
}

export async function getThread(userId: string): Promise<MessageThread | null> {
  const map = await readThreads();
  return map[userId] ?? null;
}

export async function sendUserMessage(
  userId: string,
  username: string,
  email: string,
  text: string,
): Promise<MessageThread> {
  const map = await readThreads();
  const existing = map[userId];
  const now = Date.now();
  if (existing) {
    existing.messages.push({ id: genId(), role: 'user', text, at: now });
    existing.userReadAt = now;
    existing.updatedAt = now;
    map[userId] = existing;
    await writeThreads(map);
    return existing;
  }
  const thread: MessageThread = {
    userId,
    username,
    email,
    messages: [{ id: genId(), role: 'user', text, at: now }],
    userReadAt: now,
    adminReadAt: 0,
    updatedAt: now,
  };
  map[userId] = thread;
  await writeThreads(map);
  return thread;
}

export async function markThreadRead(userId: string): Promise<void> {
  const map = await readThreads();
  const t = map[userId];
  if (!t) return;
  t.userReadAt = Date.now();
  await writeThreads(map);
}

export async function markThreadAdminRead(userId: string): Promise<void> {
  const map = await readThreads();
  const t = map[userId];
  if (!t) return;
  t.adminReadAt = Date.now();
  t.userReadAt = Math.max(t.userReadAt, Date.now());
  await writeThreads(map);
}

export async function adminReply(userId: string, text: string): Promise<MessageThread | null> {
  const map = await readThreads();
  const t = map[userId];
  if (!t) return null;
  const now = Date.now();
  t.messages.push({ id: genId(), role: 'admin', text, at: now });
  t.adminReadAt = now;
  t.updatedAt = now;
  await writeThreads(map);
  return t;
}

export async function listThreads(): Promise<MessageThread[]> {
  const map = await readThreads();
  return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function unreadForUser(t: MessageThread): number {
  return t.messages.filter((m) => m.role === 'admin' && m.at > t.userReadAt).length;
}

export function unreadForAdmin(t: MessageThread): number {
  return t.messages.filter((m) => m.role === 'user' && m.at > t.adminReadAt).length;
}

export async function getUnreadCountForUser(userId: string): Promise<number> {
  const t = await getThread(userId);
  if (!t) return 0;
  return unreadForUser(t);
}

export async function getUnreadCountForAdmin(): Promise<number> {
  const threads = await listThreads();
  return threads.reduce((acc, t) => acc + unreadForAdmin(t), 0);
}