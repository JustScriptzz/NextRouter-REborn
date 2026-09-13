import { checkPublicRateLimit, resolveApiCaller, trackingId } from '@/lib/public-access';
import { CORS_HEADERS, jsonError, jsonErrorCors } from '@/lib/http';
import { isProbeBackedOff, recordModelResult } from '@/lib/model-stats';
import { getCatalogModelProviders } from '@/lib/providers';
import {
  chatCompletions,
  parseRetryAfterMs,
  parseUpstreamErrorBody,
  UpstreamRequestError,
} from '@/lib/upstream';
import { UNLIMITED_BUDGET } from '@/lib/usage';

export const runtime = 'edge';

const RETRY_MAX_ATTEMPTS = 60;
const RETRY_BASE_DELAY_MS = 800;
const RETRY_MAX_DELAY_MS = 3000;
const RETRY_TIME_BUDGET_MS = 40000;
const REQUEST_HARD_DEADLINE_MS = 45000;
const PROVIDER_FAILOVER_ATTEMPTS = 2;
const PROVIDER_FAILOVER_BUDGET_MS = 8000;

export async function POST(req: Request) {
  const requestStart = Date.now();
  const caller = await resolveApiCaller(req);
  if (!caller) return jsonErrorCors(401, 'Invalid API key. Use the public key from the Docs page.');
  const limited = checkPublicRateLimit(caller);
  if (limited) return jsonErrorCors(429, limited, 'rate_limit');
  const trackId = trackingId(caller);
  // No per-user keys, no token caps: public callers are gated only by the
  // fixed 20 RPM + 500/day per IP above. Admins are unlimited.
  const remaining = UNLIMITED_BUDGET;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.model !== 'string' || !Array.isArray(body.messages)) {
    return jsonErrorCors(400, 'Request body must include "model" and "messages"');
  }
  const modelId = body.model;

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
    // Pipes recently backed off after a 429 go last so a throttled key isn't
    // hammered again while its quota recovers.
    const orderedPipes = [
      ...catalogPipes.filter((p) => !isProbeBackedOff(p.id)),
      ...catalogPipes.filter((p) => isProbeBackedOff(p.id)),
    ];
    // Stats are recorded once per REQUEST (not per pipe attempt): a failover
    // that ends in success must not paint the model red because an earlier
    // pipe flaked. Only a request where every pipe failed records a fail.
    let saw429 = false;
    for (const pipe of orderedPipes) {
      if (Date.now() >= deadline) break;
      const pipeStart = Date.now();
      try {
        const res = await withRetry(
          () =>
            chatCompletions({
              baseUrl: pipe.baseUrl,
              apiKey: pipe.apiKey,
              upstreamModel: pipe.upstreamModel,
              publicModelId: pipe.id,
              body,
              signal,
              userId: trackId,
              remainingBudget: remaining,
            }),
          {
            maxAttempts: PROVIDER_FAILOVER_ATTEMPTS,
            deadlineAt: Math.min(deadline, Date.now() + PROVIDER_FAILOVER_BUDGET_MS),
          },
        );
        recordModelResult(pipe.id, true, Date.now() - pipeStart, undefined, undefined, saw429 ? 429 : undefined);
        return res;
      } catch (error) {
        if (isAbortError(error)) {
          console.warn('[chat] pipe aborted', { model: modelId, provider: pipe.provider });
          return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
        }
        // Pass the status through so a 429 starts the 6h probe backoff for
        // this model instead of only affecting this one request.
        const pipeStatus = error instanceof UpstreamRequestError ? error.status : undefined;
        if (pipeStatus === 429) saw429 = true;
        console.warn('[chat] pipe failed', {
          model: modelId,
          provider: pipe.provider,
          upstream: pipe.upstreamModel,
          status: pipeStatus,
          message:
            error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160),
        });
        lastError = error;
      }
    }
    if (lastError instanceof UpstreamRequestError) {
      recordModelResult(modelId, false, Date.now() - requestStart, undefined, undefined, lastError.status);
      console.warn('[chat] all pipes failed', { model: modelId, status: lastError.status });
      return upstreamErrorWithRetryAfter(lastError);
    }
    if (lastError) {
      recordModelResult(modelId, false, Date.now() - requestStart);
    }
    return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
  }

  return jsonErrorCors(404, `Model "${modelId}" not found`);
}

function isRetryable(status: number): boolean {
  // 429 is deliberately NOT retryable here: hammering an exhausted quota
  // only extends the throttle. Fail fast so failover (or the client) can
  // move on; the 6h probe backoff handles the cool-down.
  return status >= 500 || status === 408 || status === 425;
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
        const err = new UpstreamRequestError(
          result.status,
          detail ? parseUpstreamErrorBody(detail) : 'Upstream request failed',
        );
        // 429 means exhausted quota: never sleep-and-retry it, and carry any
        // provider Retry-After through so the client can back off too.
        if (result.status === 429) {
          err.retryAfterMs = parseRetryAfterMs(result.headers.get('retry-after'));
          throw err;
        }
        throw err;
      }
      return result;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      lastError = error;
      // Fail fast on 429 — retrying a throttled key only extends the ban.
      if (error instanceof UpstreamRequestError && error.status === 429) {
        break;
      }
      if (attempt === maxAttempts || Date.now() >= deadlineAt) {
        break;
      }
      await sleep(backoffFor(attempt));
    }
  }
  throw lastError;
}

async function readErrorText(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return response.statusText || 'Upstream request failed';
  return parseUpstreamErrorBody(text);
}

// 429s carry the provider's Retry-After through as an HTTP header so
// clients can back off instead of polling into a quota ban.
function upstreamErrorWithRetryAfter(error: UpstreamRequestError): Response {
  const message = parseUpstreamErrorBody(error.message);
  if (error.status === 429 && error.retryAfterMs !== null) {
    const secs = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
    return jsonError(429, message, 'upstream_error', {
      ...CORS_HEADERS,
      'Retry-After': String(secs),
    });
  }
  return jsonErrorCors(error.status, message, 'upstream_error');
}

function scrubMessage(message: string): string {
  const urlPattern = new RegExp('https?:\\/\\/\\S+', 'g');
  return message.replace(urlPattern, '').slice(0, 500);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
}

export const maxDuration = 300;
