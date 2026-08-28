import { getSessionUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { verifySolution } from '@/lib/altcha';
import { createLimitRequest } from '@/lib/user-limits';

export const runtime = 'nodejs';

function genId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseAmount(v: unknown): number | null {
  if (v === null || v === '' || v === undefined) return null; // null = infinity
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');

  const body = (await req.json().catch(() => null)) as {
    altcha?: unknown;
    rpm?: unknown;
    tokens?: unknown;
    why?: unknown;
    models?: unknown;
  } | null;
  if (!body) return jsonError(400, 'Invalid request body');

  // Robot check
  if (!verifySolution(body.altcha)) {
    return jsonError(400, 'Captcha verification failed. Please try again.');
  }

  const why = typeof body.why === 'string' ? body.why.trim().slice(0, 2000) : '';
  const models = typeof body.models === 'string' ? body.models.trim().slice(0, 1000) : '';
  if (!why || !models) {
    return jsonError(400, 'Tell us why and which models you plan to use.');
  }

  const rpmRequested = parseAmount(body.rpm);
  const tokensRequested = parseAmount(body.tokens);
  if (rpmRequested === null && body.rpm !== null && body.rpm !== '' && body.rpm !== undefined) {
    return jsonError(400, 'Invalid RPM value');
  }
  if (tokensRequested === null && body.tokens !== null && body.tokens !== '' && body.tokens !== undefined) {
    return jsonError(400, 'Invalid token limit value');
  }
  // Only allow increases
  if (rpmRequested !== null && rpmRequested < 15) {
    return jsonError(400, 'RPM increase must be at least 15');
  }
  if (tokensRequested !== null && tokensRequested < 500000) {
    return jsonError(400, 'Token limit increase must be greater than the default 500000');
  }

  await createLimitRequest({
    id: genId(),
    userId: user.id,
    username: user.username,
    email: user.email,
    requestedRpm: rpmRequested,
    requestedTokens: tokensRequested,
    why,
    models,
  });

  return jsonOk({ ok: true, message: 'Request submitted. You will see the result next time you visit.' }, 201);
}
