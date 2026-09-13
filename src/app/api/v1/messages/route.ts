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

// Node.js, not edge: same reasoning as /api/v1/chat/completions — the edge
// runtime is killed ~25s in on Hobby, which 504s slow upstream completions.
export const runtime = 'nodejs';

const RETRY_MAX_ATTEMPTS = 60;
const RETRY_BASE_DELAY_MS = 800;
const RETRY_MAX_DELAY_MS = 3000;
const RETRY_TIME_BUDGET_MS = 40000;
const REQUEST_HARD_DEADLINE_MS = 45000;
const PROVIDER_FAILOVER_ATTEMPTS = 2;
const PROVIDER_FAILOVER_BUDGET_MS = 8000;

type AnthropicBlock = { type?: string; [key: string]: unknown };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicBlock[];
}

// --- Anthropic Messages -> OpenAI chat/completions body -------------------

function blockToText(block: AnthropicBlock): string {
  if (block.type === 'text' && typeof block.text === 'string') return block.text;
  if (block.type === 'tool_result') {
    const content = block.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((c) => (c && typeof c === 'object' && typeof (c as AnthropicBlock).text === 'string' ? (c as AnthropicBlock).text : ''))
        .filter(Boolean)
        .join('\n');
    }
  }
  if (block.type === 'tool_use') {
    return `[tool_use: ${String(block.name ?? '')} ${JSON.stringify(block.input ?? {})}]`;
  }
  return '';
}

function extractText(content: string | AnthropicBlock[] | undefined): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(blockToText).filter(Boolean).join('\n');
}

function systemToText(system: unknown): string {
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    return system
      .map((b) => (b && typeof b === 'object' && (b as AnthropicBlock).type === 'text' ? String((b as AnthropicBlock).text ?? '') : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function anthropicToOpenAiMessages(body: Record<string, unknown>): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const systemText = systemToText(body.system);
  if (systemText.trim()) out.push({ role: 'system', content: systemText });
  const messages = Array.isArray(body.messages) ? (body.messages as AnthropicMessage[]) : [];
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    out.push({ role: m.role, content: extractText(m.content) });
  }
  return out;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function mapFinishReason(reason: string | null | undefined): string {
  switch (reason) {
    case 'length':
      return 'max_tokens';
    case 'tool_calls':
    case 'function_call':
      return 'tool_use';
    default:
      return 'end_turn';
  }
}

function msgId(): string {
  return 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// --- route ------------------------------------------------------------

export async function POST(req: Request) {
  const requestStart = Date.now();
  const caller = await resolveApiCaller(req);
  if (!caller) return jsonErrorCors(401, 'Invalid API key. Use the public key from the Docs page.');
  const limited = checkPublicRateLimit(caller);
  if (limited) return jsonErrorCors(429, limited, 'rate_limit');
  const trackId = trackingId(caller);
  const remaining = UNLIMITED_BUDGET;

  const anthropicBody = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    !anthropicBody ||
    typeof anthropicBody.model !== 'string' ||
    !Array.isArray(anthropicBody.messages)
  ) {
    return jsonErrorCors(400, 'Request body must include "model" and "messages"');
  }
  const modelId = anthropicBody.model;
  const wantsStream = anthropicBody.stream === true;
  const maxTokens = typeof anthropicBody.max_tokens === 'number' ? anthropicBody.max_tokens : 1024;

  const openAiBody: Record<string, unknown> = {
    model: modelId,
    messages: anthropicToOpenAiMessages(anthropicBody),
    max_tokens: maxTokens,
    stream: wantsStream,
  };
  if (typeof anthropicBody.temperature === 'number') openAiBody.temperature = anthropicBody.temperature;
  if (typeof anthropicBody.top_p === 'number') openAiBody.top_p = anthropicBody.top_p;
  if (Array.isArray(anthropicBody.stop_sequences)) openAiBody.stop = anthropicBody.stop_sequences;

  const controller = new AbortController();
  req.signal.addEventListener('abort', () => controller.abort());
  const signal = controller.signal;

  const catalogPipes = await getCatalogModelProviders(modelId);
  const primaryPipe = catalogPipes[0];
  if (!primaryPipe) return jsonErrorCors(404, `Model "${modelId}" not found`);
  if (primaryPipe.type !== 'text') return jsonErrorCors(400, `Model "${modelId}" is not a text model`);

  const deadline = Math.min(
    requestStart + RETRY_TIME_BUDGET_MS,
    requestStart + REQUEST_HARD_DEADLINE_MS,
  );
  const orderedPipes = [
    ...catalogPipes.filter((p) => !isProbeBackedOff(p.id)),
    ...catalogPipes.filter((p) => isProbeBackedOff(p.id)),
  ];

  let lastError: unknown = null;
  let saw429 = false;
  for (const pipe of orderedPipes) {
    if (Date.now() >= deadline) break;
    const pipeStart = Date.now();
    try {
      const openAiResponse = await withRetry(
        () =>
          chatCompletions({
            baseUrl: pipe.baseUrl,
            apiKey: pipe.apiKey,
            upstreamModel: pipe.upstreamModel,
            publicModelId: pipe.id,
            body: openAiBody,
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
      return wantsStream
        ? await streamAsAnthropic(openAiResponse, modelId)
        : await jsonAsAnthropic(openAiResponse, modelId);
    } catch (error) {
      if (isAbortError(error)) {
        console.warn('[messages] pipe aborted', { model: modelId, provider: pipe.provider });
        return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
      }
      const pipeStatus = error instanceof UpstreamRequestError ? error.status : undefined;
      if (pipeStatus === 429) saw429 = true;
      console.warn('[messages] pipe failed', {
        model: modelId,
        provider: pipe.provider,
        upstream: pipe.upstreamModel,
        status: pipeStatus,
        message: error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160),
      });
      lastError = error;
    }
  }
  if (lastError instanceof UpstreamRequestError) {
    recordModelResult(modelId, false, Date.now() - requestStart, undefined, undefined, lastError.status);
    console.warn('[messages] all pipes failed', { model: modelId, status: lastError.status });
    return upstreamErrorWithRetryAfter(lastError);
  }
  if (lastError) {
    recordModelResult(modelId, false, Date.now() - requestStart);
  }
  return jsonErrorCors(502, 'Upstream request failed', 'upstream_error');
}

// --- OpenAI response -> Anthropic Messages response --------------------

async function jsonAsAnthropic(upstream: Response, modelId: string): Promise<Response> {
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return jsonErrorCors(
      upstream.status,
      text ? parseUpstreamErrorBody(text) : 'Upstream request failed',
      'upstream_error',
    );
  }
  const data = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  const choice = (data?.choices as Array<Record<string, unknown>> | undefined)?.[0];
  const message = choice?.message as Record<string, unknown> | undefined;
  const text = typeof message?.content === 'string' ? message.content : '';
  const usage = data?.usage as Record<string, unknown> | undefined;
  const inputTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : estimateTokens('');
  const outputTokens = typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : estimateTokens(text);

  return Response.json(
    {
      id: msgId(),
      type: 'message',
      role: 'assistant',
      model: modelId,
      content: [{ type: 'text', text }],
      stop_reason: mapFinishReason(choice?.finish_reason as string | undefined),
      stop_sequence: null,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    },
    { status: 200, headers: CORS_HEADERS },
  );
}

async function streamAsAnthropic(upstream: Response, modelId: string): Promise<Response> {
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return jsonErrorCors(
      upstream.status || 502,
      text ? parseUpstreamErrorBody(text) : 'Upstream request failed',
      'upstream_error',
    );
  }

  const id = msgId();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send('message_start', {
        type: 'message_start',
        message: {
          id,
          type: 'message',
          role: 'assistant',
          model: modelId,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      });
      send('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      });

      let buffer = '';
      let outputChars = 0;
      let finishReason: string | undefined;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;
            let json: Record<string, unknown>;
            try {
              json = JSON.parse(payload);
            } catch {
              continue;
            }
            const choice = (json.choices as Array<Record<string, unknown>> | undefined)?.[0];
            const delta = choice?.delta as Record<string, unknown> | undefined;
            const deltaText = typeof delta?.content === 'string' ? delta.content : '';
            if (deltaText) {
              outputChars += deltaText.length;
              send('content_block_delta', {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: deltaText },
              });
            }
            if (choice?.finish_reason) finishReason = choice.finish_reason as string;
          }
        }
      } catch {
        // Upstream stream errored mid-flight — close cleanly below instead
        // of leaving the client hanging on an open connection.
      }

      send('content_block_stop', { type: 'content_block_stop', index: 0 });
      send('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: mapFinishReason(finishReason), stop_sequence: null },
        usage: { output_tokens: estimateTokens('x'.repeat(outputChars)) },
      });
      send('message_stop', { type: 'message_stop' });
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// --- retry/failover plumbing (mirrors /api/v1/chat/completions) --------

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
        if (result.status === 429) {
          err.retryAfterMs = parseRetryAfterMs(result.headers.get('retry-after'));
          throw err;
        }
        throw err;
      }
      return result;
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error;
      if (error instanceof UpstreamRequestError && error.status === 429) break;
      if (attempt === maxAttempts || Date.now() >= deadlineAt) break;
      await sleep(backoffFor(attempt));
    }
  }
  throw lastError;
}

function upstreamErrorWithRetryAfter(error: UpstreamRequestError): Response {
  const message = parseUpstreamErrorBody(error.message);
  if (error.status === 429 && error.retryAfterMs !== null) {
    const secs = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
    return jsonError(429, message, 'upstream_error', { ...CORS_HEADERS, 'Retry-After': String(secs) });
  }
  return jsonErrorCors(error.status, message, 'upstream_error');
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export const maxDuration = 300;
