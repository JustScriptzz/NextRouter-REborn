import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(admin.email)) return jsonError(403, 'Admin only');

  const body = (await req.json().catch(() => null)) as { email?: unknown; newPassword?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError(400, 'Valid email required');
  if (newPassword.length < 8) return jsonError(400, 'New password must be at least 8 characters');
  if (isAdminEmail(email)) return jsonError(403, 'Cannot reset another admin account');

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) return jsonError(404, 'User not found');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  return jsonOk({ ok: true, message: `Password reset for ${email}` });
}
