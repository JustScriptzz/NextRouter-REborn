import { getUserFromApiKey } from '@/lib/auth';
import { decryptSecret } from '@/lib/crypto';
import { findCustomModelForCaller } from '@/lib/customModels';
import { jsonErrorCors } from '@/lib/http';
import { recordModelResult } from '@/lib/model-stats';
import { getCatalogModel, getCatalogModelProviders } from '@/lib/providers';
import { rateLimiter } from '@/lib/rateLimit';
import { chatCompletions, UpstreamRequestError } from '@/lib/upstream';
import { getEffectiveLimits } from '@/lib/user-limits';
import { getTodayUsage, getUsageRemaining, isUnlimitedEmail, UNLIMITED_BUDGET } from '@/lib/usage';

export const runtime = 'nodejs';

const RETRY_MAX_ATTEMPTS = 60;
const RETRY_BASE_DELAY_MS = 800;
const RETRY_MAX_DELAY_MS = 3000;
const RETRY_TIME_BUDGET_MS = 40000;
const REQUEST_HARD_DEADLINE_MS = 45000;
const PROVIDER_FAILOVER_ATTEMPTS = 2;
const PROVIDER_FAILOVER_BUDGET_MS = 8000;

export async function POST(req: Request) {
  const requestStart = Date.now();
  const user = await getUserFromApiKey(req.headers.get('authorization'));
  if (!user) return jsonErrorCors(401, 'Missing or invalid API key');

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.model !== 'string' || !Array.isArray(body.messages)) {
    return jsonErrorCors(400, 'Request body must include "model" and "messages"');
  }
  const modelId = body.model;

  const unlimited = isUnlimitedEmail(user.email);
  const { rpm: userRpm, tokenLimit: userTokenLimit } = unlimited
    ? { rpm: Number.MAX_SAFE_INTEGER, tokenLimit: UNLIMITED_BUDGET }
    : await getEffectiveLimits(user.id);

  // Per-user RPM gate (default 15)
  if (userRpm > 0 && !rateLimiter.allow(`user-rpm:${user.id}`, userRpm)) {
    return jsonErrorCors(429, 'Rate limit exceeded for your account. Increase your RPM on the Limits page.', 'rate_limit');
  }

  const { tokens: usedToday } = await getTodayUsage(user.id);
  const remaining = Math.max(0, userTokenLimit - usedToday);
  if (remaining <= 0) {
    return jsonErrorCors(
      429,
      `Daily token limit of ${userTokenLimit} tokens reached. It resets at midnight UTC.`,
      'daily_limit',
    );
  }

  const controller = new AbortController();
  req.signal.addEventListener('abort', () => controller.abort());
  const signal = controller.signal;

  const catalogPipes = await getCatalogModelProviders(modelId);
  const primaryPipe = catalogPipes[0];
  if (primaryPipe) {
    if (primaryPipe.type !== 'text') {
      return jsonErrorCors(400, `Model "${modelId}" is not a text model`);
    }
    const deadline = Math.min(
      requestStart + RETRY_TIME_BUDGET_MS,
      requestStart + REQUEST_HARD_DEADLINE_MS,
    );
    let lastError: unknown = null;
    // Single fast pass: try each provider pipe once, move on quickly, return the
    // first success. No infinite round-restarting — bounded by a tight budget so
    // slow/dead pipes return fast instead of hanging the client for minutes.
    for (const pipe of catalogPipes) {
      if (Date.now() >= deadline) break;
      const pipeStart = Date.now();
      try {
        return await withRetry(
          () =>
            chatCompletions({
              baseUrl: pipe.baseUrl,
              apiKey: pipe.apiKey,
              upstreamModel: pipe.upstreamModel,
              publicModelId: pipe.id,
              body,
              signal,
              userId: user.id,
              remainingBudget: remaining,
            }),
          {
            maxAttempts: PROVIDER_FAILOVER_ATTEMPTS,
            deadlineAt: Math.min(deadline, Date.now() + PROVIDER_FAILOVER_BUDGET_MS),
          },
        );
      } catch (error) {
        if (isAbortError(error)) {
          return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
        }
        recordModelResult(pipe.id, false, Date.now() - pipeStart);
        lastError = error;
      }
    }
    if (lastError instanceof UpstreamRequestError) {
      return jsonErrorCors(lastError.status, scrubMessage(lastError.message), 'upstream_error');
    }
    return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
  }

  const custom = await findCustomModelForCaller(modelId, user);
  if (!custom) {
    return jsonErrorCors(404, `Model "${modelId}" not found`);
  }
  const rpm = custom.rpm;
  if (!unlimited && rpm && !rateLimiter.allow(`custom:${custom.modelId}:${user.id}`, rpm)) {
    return jsonErrorCors(429, 'Rate limit exceeded for this model', 'rate_limit');
  }

  let primaryError: { status: number; message: string } | null = null;
  const primaryStart = Date.now();
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      const token = custom.bearerTokenEnc ? decryptSecret(custom.bearerTokenEnc) : '';
      const response = await chatCompletions({
        baseUrl: custom.endpointUrl,
        apiKey: token,
        upstreamModel: custom.providerModelId,
        publicModelId: custom.modelId,
        body,
        signal,
        userId: user.id,
        remainingBudget: remaining,
      });
      if (response.ok) return response;
      if (!isRetryable(response.status)) {
        primaryError = {
          status: response.status,
          message: await readErrorText(response),
        };
        break;
      }
      primaryError = { status: response.status, message: 'Upstream request failed' };
    } catch (error) {
      if (error instanceof UpstreamRequestError && !isRetryable(error.status)) {
        return jsonErrorCors(error.status, scrubMessage(error.message), 'upstream_error');
      }
      if (isAbortError(error)) {
        return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
      }
      primaryError = { status: 502, message: 'Upstream request failed' };
    }
    if (attempt === RETRY_MAX_ATTEMPTS || Date.now() - primaryStart > RETRY_TIME_BUDGET_MS) {
      break;
    }
    await sleep(backoffFor(attempt));
  }

  if (primaryError && primaryError.status < 500) {
    return jsonErrorCors(primaryError.status, scrubMessage(primaryError.message), 'upstream_error');
  }

  const fallback = await getCatalogModel(custom.fallbackModelId);
  if (fallback && fallback.type === 'text') {
    try {
      const effectiveRemaining = unlimited ? UNLIMITED_BUDGET : await getUsageRemaining(user.id);
      if (effectiveRemaining <= 0) {
        return jsonErrorCors(
          429,
          'Daily token limit of 500000 tokens reached. It resets at midnight UTC.',
          'daily_limit',
        );
      }
      return await withRetry(() =>
        chatCompletions({
          baseUrl: fallback.baseUrl,
          apiKey: fallback.apiKey,
          upstreamModel: fallback.upstreamModel,
          publicModelId: fallback.id,
          body,
          signal,
          userId: user.id,
          remainingBudget: effectiveRemaining,
        }),
      );
    } catch {
      return jsonErrorCors(502, 'The model and its fallback both failed', 'upstream_error');
    }
  }

  return primaryError
    ? jsonErrorCors(primaryError.status, scrubMessage(primaryError.message), 'upstream_error')
    : jsonErrorCors(502, 'The model failed and no fallback is available', 'upstream_error');
}

function isRetryable(status: number): boolean {
  return status >= 500 || status === 408 || status === 425 || status === 429;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

function backoffFor(attempt: number): number {
  const base = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), RETRY_MAX_DELAY_MS);
  return Math.random() * base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RetryOptions {
  maxAttempts?: number;
  deadlineAt?: number;
}

async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const start = Date.now();
  const maxAttempts = opts.maxAttempts ?? RETRY_MAX_ATTEMPTS;
  const deadlineAt = opts.deadlineAt ?? start + RETRY_TIME_BUDGET_MS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (result instanceof Response && !result.ok) {
        const detail = await result.text().catch(() => '');
        throw new UpstreamRequestError(
          result.status,
          detail ? detail.slice(0, 300) : 'Upstream request failed',
        );
      }
      return result;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      lastError = error;
      if (attempt === maxAttempts || Date.now() >= deadlineAt) {
        break;
      }
      await sleep(backoffFor(attempt));
    }
  }
  throw lastError;
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

export const maxDuration = 300;
