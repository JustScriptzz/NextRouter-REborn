import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { createSession } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';
import { isDisposableEmail } from '@/lib/email-blocklist';

export const runtime = 'nodejs';

async function verifyTurnstile(token: unknown, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== 'string' || !token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { username?: unknown; email?: unknown; password?: unknown; turnstileToken?: unknown }
    | null;
  if (!body) return jsonError(400, 'Invalid request body');

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)) {
    return jsonError(400, 'Username must be 3-32 characters using lowercase letters, numbers, _ or -');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError(400, 'Invalid email address');
  }
  if (isDisposableEmail(email)) {
    return jsonError(400, 'Temporary or disposable email addresses are not allowed. Please use a real email.');
  }
  if (password.length < 8) {
    return jsonError(400, 'Password must be at least 8 characters');
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const captchaOk = await verifyTurnstile(body.turnstileToken, ip);
  if (!captchaOk) {
    return jsonError(403, 'Captcha verification failed. Please try again.');
  }

  const existingUsername = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existingUsername.length > 0) return jsonError(409, 'Username is already taken');

  const existingEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingEmail.length > 0) return jsonError(409, 'Email is already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ username, email, passwordHash })
    .returning();

  await createSession({ id: user!.id, email: user!.email, username: user!.username });
  return jsonOk({ user: { id: user!.id, email: user!.email, username: user!.username } });
}