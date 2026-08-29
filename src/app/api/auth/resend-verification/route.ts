import { jsonError, jsonOk } from '@/lib/http';
import { isDisposableEmail } from '@/lib/email-blocklist';
import { isSmtpConfigured, sendVerifyEmail } from '@/lib/mail';
import { getPending, getTokenFor } from '@/lib/verify';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError(400, 'Invalid email address');
  }

  const pending = await getPending(email);
  if (!pending) return jsonError(404, 'No pending verification found for this email.');

  if (!isSmtpConfigured()) {
    return jsonError(503, 'Mail server is not configured.');
  }

  const token = (await getTokenFor(email)) ?? pending.token;
  const send = await sendVerifyEmail(email, token);
  if (!send.ok) {
    return jsonError(502, `Failed to resend: ${send.error ?? 'unknown error'}`);
  }
  return jsonOk({ ok: true, message: 'Verification email sent.' });
}