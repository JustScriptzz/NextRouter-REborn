import { getUserFromApiKey } from '@/lib/auth';
import { decryptSecret } from '@/lib/crypto';
import { findCustomModelForCaller } from '@/lib/customModels';
import { jsonErrorCors } from '@/lib/http';
import { getCatalogModel, getCatalogModelProviders } from '@/lib/providers';
import { rateLimiter } from '@/lib/rateLimit';
import { embeddingsCall, UpstreamRequestError } from '@/lib/upstream';
import { cycleProviderPipes } from '@/lib/provider-cycle';
import { getUsageRemaining, isUnlimitedEmail, UNLIMITED_BUDGET } from '@/lib/usage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const requestStart = Date.now();
  const user = await getUserFromApiKey(req.headers.get('authorization'));
  if (!user) return jsonErrorCors(401, 'Missing or invalid API key');

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.model !== 'string' || !body.input) {
    return jsonErrorCors(400, 'Request body must include "model" and "input"');
  }
  const modelId = body.model;

  const unlimited = isUnlimitedEmail(user.email);
  const remaining = unlimited ? UNLIMITED_BUDGET : await getUsageRemaining(user.id);
  if (remaining <= 0) {
    return jsonErrorCors(
      429,
      'Daily token limit of 500000 tokens reached. It resets at midnight UTC.',
      'daily_limit',
    );
  }

  const controller = new AbortController();
  req.signal.addEventListener('abort', () => controller.abort());
  const signal = controller.signal;

  const embeddingPipes = (await getCatalogModelProviders(modelId)).filter(
    (e) => e.type === 'embedding',
  );
  if (embeddingPipes.length > 0) {
    return cycleProviderPipes({
      pipes: embeddingPipes,
      requestStart,
      budgetMs: 110000,
      call: (pipe) =>
        embeddingsCall({
          baseUrl: pipe.baseUrl,
          apiKey: pipe.apiKey,
          upstreamModel: pipe.upstreamModel,
          publicModelId: pipe.id,
          body,
          signal,
          userId: user.id,
        }),
    });
  }

  const custom = await findCustomModelForCaller(modelId, user);
  if (!custom) {
    return jsonErrorCors(404, `Model "${modelId}" not found`);
  }
  if (!custom.acceptedInputs.includes('text')) {
    return jsonErrorCors(400, `Model "${modelId}" does not accept text input`);
  }
  const rpm = custom.rpm;
  if (!unlimited && rpm && !rateLimiter.allow(`custom:${custom.modelId}:${user.id}`, rpm)) {
    return jsonErrorCors(429, 'Rate limit exceeded for this model', 'rate_limit');
  }

  let primaryError: { status: number; message: string } | null = null;
  try {
    const token = custom.bearerTokenEnc ? decryptSecret(custom.bearerTokenEnc) : '';
    const response = await embeddingsCall({
      baseUrl: custom.endpointUrl,
      apiKey: token,
      upstreamModel: custom.providerModelId,
      publicModelId: custom.modelId,
      body,
      signal,
      userId: user.id,
    });
    if (response.ok) return response;
    primaryError = {
      status: response.status,
      message: response.status >= 500 ? 'Upstream request failed' : await readErrorText(response),
    };
  } catch (error) {
    if (error instanceof UpstreamRequestError && error.status < 500) {
      return jsonErrorCors(error.status, scrubMessage(error.message), 'upstream_error');
    }
  }

  if (primaryError && primaryError.status < 500) {
    return jsonErrorCors(primaryError.status, scrubMessage(primaryError.message), 'upstream_error');
  }

  const fallback = await getCatalogModel(custom.fallbackModelId);
  if (fallback && fallback.type === 'embedding') {
    try {
      return await embeddingsCall({
        baseUrl: fallback.baseUrl,
        apiKey: fallback.apiKey,
        upstreamModel: fallback.upstreamModel,
        publicModelId: fallback.id,
        body,
        signal,
        userId: user.id,
      });
    } catch {
      return jsonErrorCors(502, 'The model and its fallback both failed', 'upstream_error');
    }
  }

  return primaryError
    ? jsonErrorCors(primaryError.status, scrubMessage(primaryError.message), 'upstream_error')
    : jsonErrorCors(502, 'The model failed and no fallback is available', 'upstream_error');
}

async function readErrorText(response: Response): Promise<string> {
  try {
    const parsed = (await response.json()) as { error?: { message?: unknown } };
    if (parsed.error?.message && typeof parsed.error.message === 'string') {
      return parsed.error.message;
    }
  } catch {
    /* keep generic */
  }
  return response.statusText || 'Upstream request failed';
}

function scrubMessage(message: string): string {
  const urlPattern = new RegExp('https?:\\/\\/\\S+', 'g');
  return message.replace(urlPattern, '').slice(0, 500);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
}

export const maxDuration = 150;
