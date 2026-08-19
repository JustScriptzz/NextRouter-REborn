import { getUserFromApiKey } from '@/lib/auth';
import { decryptSecret } from '@/lib/crypto';
import { findCustomModelForCaller } from '@/lib/customModels';
import { jsonErrorCors } from '@/lib/http';
import { rateLimiter } from '@/lib/rateLimit';
import { audioSpeech, UpstreamRequestError } from '@/lib/upstream';
import { getUsageRemaining } from '@/lib/usage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await getUserFromApiKey(req.headers.get('authorization'));
  if (!user) return jsonErrorCors(401, 'Missing or invalid API key');

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.model !== 'string' || typeof body.input !== 'string') {
    return jsonErrorCors(400, 'Request body must include "model" and "input"');
  }
  const modelId = body.model;

  const remaining = await getUsageRemaining(user.id);
  if (remaining <= 0) {
    return jsonErrorCors(
      429,
      'Daily token limit reached (500,000). It resets at midnight UTC.',
      'daily_limit',
    );
  }

  const controller = new AbortController();
  req.signal.addEventListener('abort', () => controller.abort());
  const signal = controller.signal;

  const custom = await findCustomModelForCaller(modelId, user);
  if (!custom) {
    return jsonErrorCors(404, `Model "${modelId}" not found`);
  }
  if (!custom.acceptedInputs.includes('tts')) {
    return jsonErrorCors(400, `Model "${modelId}" does not support text-to-speech`);
  }
  const rpm = custom.rpm;
  if (rpm && !rateLimiter.allow(`custom:${custom.modelId}:${user.id}`, rpm)) {
    return jsonErrorCors(429, 'Rate limit exceeded for this model', 'rate_limit');
  }

  try {
    const token = custom.bearerTokenEnc ? decryptSecret(custom.bearerTokenEnc) : '';
    const response = await audioSpeech({
      baseUrl: custom.endpointUrl,
      apiKey: token,
      upstreamModel: custom.providerModelId,
      publicModelId: custom.modelId,
      body,
      signal,
      userId: user.id,
    });
    if (response.ok) return response;
    throw new UpstreamRequestError(response.status, 'Upstream request failed');
  } catch (error) {
    if (error instanceof UpstreamRequestError && error.status < 500) {
      return jsonErrorCors(error.status, error.message, 'upstream_error');
    }
    return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
}