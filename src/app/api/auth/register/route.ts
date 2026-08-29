import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';
import { isDisposableEmail } from '@/lib/email-blocklist';
import { verifySolution } from '@/lib/altcha';
import { isSmtpConfigured, sendVerifyEmail } from '@/lib/mail';
import { createPendingVerification, deletePending, isEmailVerified } from '@/lib/verify';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { username?: unknown; email?: unknown; password?: unknown; altchaPayload?: unknown }
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
  if (!verifySolution(body.altchaPayload)) {
    return jsonError(403, 'Captcha verification failed. Please try again.');
  }

  const existingUsername = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existingUsername.length > 0) return jsonError(409, 'Username is already taken');

  const existingEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingEmail.length > 0) return jsonError(409, 'Email is already registered');

  if (await isEmailVerified(email)) return jsonError(409, 'Email is already registered');

  const passwordHash = await bcrypt.hash(password, 10);

  if (!isSmtpConfigured()) {
    if (process.env.ALLOW_UNVERIFIED_LOGIN !== 'true') {
      return jsonError(
        503,
        'Email verification is enabled but no mail server (SMTP) is configured yet.',
      );
    }
    // Opt-in straight login: create the account directly (no email verification).
    const [user] = await db.insert(users).values({ username, email, passwordHash }).returning();
    return jsonOk({
      user: { id: user!.id, email: user!.email, username: user!.username },
      verification: 'disabled',
    });
  }

  const { token } = await createPendingVerification(email, username, passwordHash);
  const send = await sendVerifyEmail(email, token);

  if (!send.ok) {
    await deletePending(email).catch(() => undefined);
    return jsonError(502, `Failed to send verification email: ${send.error ?? 'unknown error'}`);
  }

  return jsonOk(
    {
      verification: 'required',
      message:
        'Almost there! Check your inbox for a verification link. Your account is created once you click it.',
    },
    201,
  );
}