import { getSessionUser } from '@/lib/auth';
import { isAdminEmail, isBannedEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { kvGet, kvSet, kvInvalidateCache } from '@/lib/kv';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getSessionUser();
  if (!admin) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(admin.email)) return jsonError(403, 'Admin only');
  const banned = await kvGet('banned_emails');
  return jsonOk({ banned });
}

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(admin.email)) return jsonError(403, 'Admin only');

  const body = (await req.json().catch(() => null)) as { email?: unknown; banned?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const bannedFlag = !!body?.banned;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError(400, 'Valid email required');
  if (isAdminEmail(email)) return jsonError(403, 'Cannot ban an admin account');

  const current = await kvGet('banned_emails');
  const normalized = current.map((v) => v.toLowerCase());
  const target = email.toLowerCase();
  let next: string[];
  if (bannedFlag) {
    next = normalized.includes(target) ? current : [...current, email];
  } else {
    next = current.filter((v) => v.toLowerCase() !== target);
  }
  await kvSet('banned_emails', next);
  kvInvalidateCache();
  return jsonOk({ ok: true, banned: next, isBanned: bannedFlag ? isBannedEmail(email) : false });
}
