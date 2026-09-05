import { getSessionUser } from '@/lib/auth';
import { isAdminEmail, listAdminEmails } from '@/lib/admin';
import { kvGet, kvSet, kvInvalidateCache } from '@/lib/kv';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');
  const admins = await listAdminEmails();
  return jsonOk({ admins });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');

  const body = (await req.json().catch(() => null)) as { email?: unknown; admin?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError(400, 'Invalid email');
  }
  const makeAdmin = body?.admin !== false;

  const OWNER_EMAIL = 'ciullomarco13@gmail.com';
  if (!makeAdmin && email === OWNER_EMAIL) {
    return jsonError(403, 'The owner account cannot have admin access removed');
  }

  const current = await kvGet('admin_emails');
  const normalized = current.map((v) => v.toLowerCase());
  let next: string[];
  if (makeAdmin) {
    if (normalized.includes(email)) return jsonOk({ admins: await listAdminEmails(), message: 'Already admin' });
    next = [...current.filter((v) => v.trim().length > 0), email];
  } else {
    next = current.filter((v) => v.toLowerCase() !== email);
  }
  await kvSet('admin_emails', next);
  kvInvalidateCache();
  return jsonOk({ admins: await listAdminEmails(), message: makeAdmin ? 'Admin added' : 'Admin removed' });
}
