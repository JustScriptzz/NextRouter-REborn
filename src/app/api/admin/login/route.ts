import { NextResponse } from 'next/server';
import { createAdminToken, checkAdminCredentials, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

export const runtime = 'edge';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password } = (body || {}) as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
  }

  if (!checkAdminCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = await createAdminToken(email.trim().toLowerCase());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
