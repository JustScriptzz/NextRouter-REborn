import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { createSession } from '@/lib/auth';
import { isBannedEmail } from '@/lib/admin';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  if (!body) return jsonError(400, 'Invalid request body');

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) return jsonError(400, 'Email and password are required');

  if (isBannedEmail(email)) return jsonError(403, 'This account has been banned');

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) return jsonError(401, 'Invalid email or password');

  if (isBannedEmail(user.email)) return jsonError(403, 'This account has been banned');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return jsonError(401, 'Invalid email or password');

  await createSession({ id: user.id, email: user.email, username: user.username });
  return jsonOk({ user: { id: user.id, email: user.email, username: user.username } });
}