import type { ModelKind } from './types';
import { recordUsage } from './usage';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function withV1Prefix(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/\/v\d+$/.test(trimmed)) return trimmed;
  if (/\/(chat\/completions|images\/generations|audio\/speech|audio\/transcriptions|models)$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/v1`;
}

export class UpstreamRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'UpstreamRequestError';
  }
}

export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateChatInputTokens(body: Record<string, unknown>): number {
  const messages = (body.messages as Array<Record<string, unknown>> | undefined) ?? [];
  let chars = 0;
  for (const message of messages) {
    const content = message.content;
    if (typeof content === 'string') {
      chars += content.length;
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part === 'object' && part !== null && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          if (typeof text === 'string') chars += text.length;
        }
      }
    }
  }
  return estimateTextTokens(chars > 0 ? String(chars) : '8');
}

function scrubUpstreamMessage(message: string): string {
  return message.replace(/https?:\/\/[^\s"')\]]+/g, '').slice(0, 500);
}

export async function upstreamErrorResponse(
  upstream: Response,
  fallbackMessage = 'Upstream request failed',
): Promise<Response> {
  const text = await upstream.text().catch(() => '');
  let message = fallbackMessage;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: unknown } };
    if (parsed.error?.message && typeof parsed.error.message === 'string') {
      message = scrubUpstreamMessage(parsed.error.message) || fallbackMessage;
    }
  } catch {
    // non-JSON upstream error body; keep generic message
  }
  return Response.json(
    { error: { message, type: 'upstream_error' } },
    { status: upstream.status >= 500 ? 502 : upstream.status, headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}

function rewriteModelName(text: string, upstreamModel: string, publicModelId: string): string {
  return text.split(`"model":"${upstreamModel}"`).join(`"model":"${publicModelId}"`);
}

export interface BudgetOptions {
  userId: string;
  remainingBudget: number;
  inputTokens: number;
  upstreamModel: string;
  publicModelId: string;
}

function createBudgetTransform(opts: BudgetOptions): TransformStream<Uint8Array, Uint8Array> {
  const { userId, remainingBudget, inputTokens, upstreamModel, publicModelId } = opts;
  let outputChars = 0;
  let recorded = false;
  let capped = false;

  async function settle(): Promise<void> {
    if (recorded) return;
    recorded = true;
    const outputTokens = Math.ceil(outputChars / 4);
    const total = inputTokens + outputTokens;
    await recordUsage(userId, total);
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      let text = dec.decode(chunk, { stream: true });
      text = rewriteModelName(text, upstreamModel, publicModelId);
      const contentMatcher = /"content":"((?:\\.|[^"\\])*)"/g;
      for (const match of text.matchAll(contentMatcher)) {
        outputChars += match[1]?.length ?? 0;
      }
      const consumed = Math.ceil(outputChars / 4);
      if (consumed >= remainingBudget && !capped) {
        capped = true;
        void settle();
        const finalChunk = {
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content: '' },
              finish_reason: 'length',
            },
          ],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: Math.min(Math.max(0, remainingBudget - inputTokens), consumed),
            total_tokens: inputTokens + Math.min(Math.max(0, remainingBudget - inputTokens), consumed),
          },
        };
        controller.enqueue(enc.encode(`data: ${JSON.stringify(finalChunk)}\n\ndata: [DONE]\n\n`));
        controller.terminate();
        return;
      }
      controller.enqueue(enc.encode(text));
    },
    async flush() {
      await settle();
    },
  });
}

export interface ChatCallOptions {
  baseUrl: string;
  apiKey: string;
  upstreamModel: string;
  publicModelId: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
  userId: string;
  remainingBudget: number;
}

export async function chatCompletions(opts: ChatCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, body, signal, userId, remainingBudget } =
    opts;
  const url = `${baseUrl}/chat/completions`;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, model: upstreamModel }),
    signal,
  }).catch(() => {
    throw new UpstreamRequestError(502, 'Upstream request failed');
  });

  if (!upstream.ok) {
    return upstreamErrorResponse(upstream);
  }

  const inputTokens = estimateChatInputTokens(body);

  if (body.stream === true) {
    const stream = upstream.body;
    if (!stream) {
      throw new UpstreamRequestError(502, 'Upstream returned no stream');
    }
    const counted = stream.pipeThrough(
      createBudgetTransform({ userId, remainingBudget, inputTokens, upstreamModel, publicModelId }),
    );
    return new Response(counted, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const data = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data) {
    throw new UpstreamRequestError(502, 'Upstream returned an invalid response');
  }
  const rewritten = rewriteModelField(data, upstreamModel, publicModelId);
  const outputTokens =
    typeof (rewritten as { usage?: { completion_tokens?: unknown } }).usage
      ?.completion_tokens === 'number'
      ? (rewritten as { usage: { completion_tokens: number } }).usage.completion_tokens
      : estimateChatOutputTokens(rewritten);
  await recordUsage(userId, inputTokens + outputTokens);
  return Response.json(rewritten, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

function rewriteModelField(
  data: Record<string, unknown>,
  upstreamModel: string,
  publicModelId: string,
): Record<string, unknown> {
  if (data.model === upstreamModel) {
    return { ...data, model: publicModelId };
  }
  return data;
}

function estimateChatOutputTokens(data: Record<string, unknown>): number {
  const choices = (data.choices as Array<Record<string, unknown>> | undefined) ?? [];
  let chars = 0;
  for (const choice of choices) {
    const message = choice.message as Record<string, unknown> | undefined;
    if (message) {
      const content = message.content;
      if (typeof content === 'string') chars += content.length;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (typeof part === 'object' && part !== null && 'text' in part) {
            const text = (part as { text?: unknown }).text;
            if (typeof text === 'string') chars += text.length;
          }
        }
      }
    }
  }
  return estimateTextTokens(chars > 0 ? String(chars) : '1');
}

export interface ImagesCallOptions {
  baseUrl: string;
  apiKey: string;
  upstreamModel: string;
  publicModelId: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
  userId: string;
}

export const IMAGE_TOKEN_COST = 1200;

export async function imagesGenerations(opts: ImagesCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, body, signal, userId } = opts;
  const url = `${baseUrl}/images/generations`;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, model: upstreamModel }),
    signal,
  }).catch(() => {
    throw new UpstreamRequestError(502, 'Upstream request failed');
  });
  if (!upstream.ok) {
    return upstreamErrorResponse(upstream);
  }
  const data = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data) {
    throw new UpstreamRequestError(502, 'Upstream returned an invalid response');
  }
  const count = Math.max(1, typeof body.n === 'number' ? Math.ceil(body.n) : 1);
  await recordUsage(userId, count * IMAGE_TOKEN_COST);
  return Response.json(data, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

export interface SpeechCallOptions {
  baseUrl: string;
  apiKey: string;
  upstreamModel: string;
  publicModelId: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
  userId: string;
}

export async function audioSpeech(opts: SpeechCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, body, signal, userId } = opts;
  const url = `${baseUrl}/audio/speech`;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, model: upstreamModel }),
    signal,
  }).catch(() => {
    throw new UpstreamRequestError(502, 'Upstream request failed');
  });
  if (!upstream.ok) {
    return upstreamErrorResponse(upstream);
  }
  const input = typeof body.input === 'string' ? body.input : '';
  await recordUsage(userId, estimateTextTokens(input));
  const contentType = upstream.headers.get('content-type') ?? 'audio/mpeg';
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export interface TranscriptionCallOptions extends SpeechCallOptions {
  formData: FormData;
}

export async function audioTranscriptions(opts: TranscriptionCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, signal, userId, formData } = opts;
  const url = `${baseUrl}/audio/transcriptions`;
  formData.set('model', upstreamModel);
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal,
  }).catch(() => {
    throw new UpstreamRequestError(502, 'Upstream request failed');
  });
  if (!upstream.ok) {
    return upstreamErrorResponse(upstream);
  }
  await recordUsage(userId, 1000);
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}