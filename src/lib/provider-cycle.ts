import type { CatalogEntry } from './providers';
import { isAuthLikeStatus, isPipeQuarantined, quarantinePipe } from './pipe-health';
import { UpstreamRequestError } from './upstream';
import { jsonErrorCors } from './http';

const PER_PIPE_ATTEMPTS = 2;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 8000;

function isRetryableStatus(status: number): boolean {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffFor(attempt: number): number {
  const base = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
  return Math.random() * base;
}

function scrubMessage(message: string): string {
  const urlPattern = new RegExp('https?:\\/\\/\\S+', 'g');
  return message.replace(urlPattern, '').slice(0, 500);
}

export interface ProviderCycleOptions {
  pipes: CatalogEntry[];
  requestStart: number;
  budgetMs: number;
  call: (pipe: CatalogEntry) => Promise<Response>;
}

export async function cycleProviderPipes(opts: ProviderCycleOptions): Promise<Response> {
  const deadlineAt = opts.requestStart + opts.budgetMs;
  let lastError: unknown = null;
  for (let round = 1; Date.now() < deadlineAt; round++) {
    let sawRetryableCause = false;
    for (const pipe of opts.pipes) {
      if (Date.now() >= deadlineAt) break;
      if (isPipeQuarantined(pipe.baseUrl, pipe.upstreamModel)) continue;
      for (let attempt = 1; attempt <= PER_PIPE_ATTEMPTS; attempt++) {
        try {
          const res = await opts.call(pipe);
          if (!res.ok && isRetryableStatus(res.status)) {
            const detail = await res.text().catch(() => '');
            throw new UpstreamRequestError(
              res.status,
              detail ? detail.slice(0, 300) : 'Upstream retryable failure',
            );
          }
          return res;
        } catch (error) {
          if (isAbortError(error)) {
            return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
          }
          lastError = error;
          if (error instanceof UpstreamRequestError && isAuthLikeStatus(error.status)) {
            quarantinePipe(pipe.baseUrl, pipe.upstreamModel);
          }
          const retryable =
            !(error instanceof UpstreamRequestError) || isRetryableStatus(error.status);
          if (retryable) sawRetryableCause = true;
          if (!retryable || attempt === PER_PIPE_ATTEMPTS || Date.now() >= deadlineAt) break;
          await sleep(Math.min(backoffFor(attempt), Math.max(1, deadlineAt - Date.now())));
        }
      }
    }
    const anyActive = opts.pipes.some((p) => !isPipeQuarantined(p.baseUrl, p.upstreamModel));
    if (!anyActive) break;
    if (Date.now() >= deadlineAt) break;
    if (!sawRetryableCause) break;
    await sleep(Math.min(backoffFor(round), Math.max(1, deadlineAt - Date.now())));
  }
  if (!lastError) {
    return jsonErrorCors(
      503,
      'All provider pipes for this model are temporarily disabled',
      'upstream_error',
    );
  }
  if (lastError instanceof UpstreamRequestError) {
    return jsonErrorCors(lastError.status, scrubMessage(lastError.message), 'upstream_error');
  }
  return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
}
