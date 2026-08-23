import { createHash, randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { apiKeys } from './db/schema';
import type { SessionUser } from './types';
import { isBannedEmail } from './admin';

const SESSION_COOKIE = 'nr_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? 'dev-secret-change-me');
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const sub = payload.sub;
    if (!sub) return null;
    const email = typeof payload.email === 'string' ? payload.email : '';
    if (isBannedEmail(email)) return null;
    return {
      id: sub,
      email,
      username: typeof payload.username === 'string' ? payload.username : '',
    };
  } catch {
    return null;
  }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(prefix = 'nr_'): { key: string; hash: string; masked: string } {
  const key = prefix + randomBytes(32).toString('base64url');
  return {
    key,
    hash: hashApiKey(key),
    masked: `${key.slice(0, 8)}...${key.slice(-4)}`,
  };
}

export async function getUserFromApiKey(
  authorization: string | null,
): Promise<SessionUser | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const key = authorization.slice(7).trim();
  if (!key.startsWith('nr_')) return null;
  const row = await db.query.apiKeys
    .findFirst({
      where: eq(apiKeys.keyHash, hashApiKey(key)),
      with: { user: true },
    })
    .catch(() => null);
  if (!row || row.revokedAt) return null;
  const user = row.user;
  if (isBannedEmail(user.email)) return null;
  return { id: user.id, email: user.email, username: user.username };
}