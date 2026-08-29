import { eq } from 'drizzle-orm';
import { createSession } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';
import { completeVerification } from '@/lib/verify';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  if (!token) return jsonError(400, 'Missing verification token');

  const pending = await completeVerification(token);
  if (!pending) {
    return jsonError(400, 'Invalid or expired verification link.');
  }

  // Create the user row now that email is verified
  const existing = await db.select().from(users).where(eq(users.email, pending.email)).limit(1);
  let user;
  if (existing.length > 0) {
    user = existing[0];
  } else {
    const existingUsername = await db
      .select()
      .from(users)
      .where(eq(users.username, pending.username))
      .limit(1);
    if (existingUsername.length > 0) {
      return jsonError(409, 'Username was taken while verifying. Please register again.');
    }
    const [created] = await db
      .insert(users)
      .values({ username: pending.username, email: pending.email, passwordHash: pending.passwordHash })
      .returning();
    user = created!;
  }

  await createSession({ id: user.id, email: user.email, username: user.username });
  return jsonOk({ ok: true, verified: true });
}