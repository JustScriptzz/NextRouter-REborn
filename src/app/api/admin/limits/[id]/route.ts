import { getSessionUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import {
  findRequest,
  setDecision,
  setUserLimits,
  updateRequest,
  type LimitRequest,
} from '@/lib/user-limits';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  if (!isAdminEmail(user.email)) return jsonError(403, 'Admin only');

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    action?: unknown;
    rpm?: unknown;
    tokens?: unknown;
    note?: unknown;
  } | null;
  if (!body) return jsonError(400, 'Invalid body');

  const action = body.action;
  if (action !== 'accept' && action !== 'reject' && action !== 'thinking') {
    return jsonError(400, 'action must be accept, reject or thinking');
  }

  const request = await findRequest(id);
  if (!request) return jsonError(404, 'Request not found');

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  if (action === 'accept') {
    let grantedRpm: number | null = request.requestedRpm;
    let grantedTokens: number | null = request.requestedTokens;
    const rpmOverride = body.rpm === undefined || body.rpm === null ? null : Number(body.rpm);
    const tokensOverride = body.tokens === undefined || body.tokens === null ? null : Number(body.tokens);
    if (rpmOverride !== null && Number.isFinite(rpmOverride)) grantedRpm = rpmOverride;
    if (tokensOverride !== null && Number.isFinite(tokensOverride)) grantedTokens = tokensOverride;

    // apply to the user's limits
    await setUserLimits(request.userId, {
      rpm: grantedRpm && grantedRpm > 0 ? grantedRpm : undefined,
      tokenLimit: grantedTokens && grantedTokens > 0 ? grantedTokens : undefined,
    });

    await updateRequest(id, {
      status: 'accepted',
      decidedRpm: grantedRpm,
      decidedTokens: grantedTokens,
      decidedNote: note,
    });
    await setDecision(request.userId, {
      decided: 'accepted',
      at: Date.now(),
      grantedRpm: grantedRpm,
      grantedTokens: grantedTokens,
      note,
    });
    return jsonOk({ ok: true, request: await findRequest(id) });
  }

  if (action === 'reject') {
    await updateRequest(id, { status: 'rejected', decidedNote: note });
    await setDecision(request.userId, { decided: 'rejected', at: Date.now(), note });
    return jsonOk({ ok: true, request: await findRequest(id) });
  }

  // thinking
  await updateRequest(id, { status: 'thinking', decidedNote: note });
  await setDecision(request.userId, { decided: 'thinking', at: Date.now(), note });
  return jsonOk({ ok: true, request: await findRequest(id) });
}
