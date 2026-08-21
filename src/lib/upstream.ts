import type { ModelKind } from './types';
import { recordUsage } from './usage';

const enc = new TextEncoder();
const dec = new TextDecoder();

function stripTrailingSlashes(value: string): string {
  let out = value;
  while (out.endsWith('/')) {
    out = out.slice(0, -1);
  }
  return out;
}

export function withV1Prefix(baseUrl: string): string {
  const trimmed = stripTrailingSlashes(baseUrl.trim());
  if (!trimmed) return '';
  const versionMarker = '/v';
  const lastMarker = trimmed.lastIndexOf(versionMarker);
  if (lastMarker !== -1) {
    const after = trimmed.slice(lastMarker + 2);
    if (after.length > 0 && Number.isInteger(Number(after))) return trimmed;
  }
  const suffixes = [
    '/chat/completions',
    '/images/generations',
    '/images/edits',
    '/audio/speech',
    '/audio/transcriptions',
    '/models',
  ];
  if (suffixes.some((s) => trimmed.endsWith(s))) return trimmed;
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

const UPSTREAM_CONNECT_TIMEOUT_MS = 30000;

function withConnectTimeout(signal: AbortSignal): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const composite = AbortSignal.any([signal, controller.signal]);
  const timer = setTimeout(() => controller.abort(), UPSTREAM_CONNECT_TIMEOUT_MS);
  return { signal: composite, clear: () => clearTimeout(timer) };
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
  return Math.max(1, Math.ceil(chars / 4));
}

function scrubUpstreamMessage(message: string): string {
  const urlPattern = new RegExp('https?:\\/\\/\\S+', 'g');
  return message.replace(urlPattern, '').slice(0, 500);
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

function countStreamContent(text: string): number {
  const marker = '"content":"';
  let total = 0;
  let idx = text.indexOf(marker);
  while (idx !== -1) {
    let j = idx + marker.length;
    while (j < text.length) {
      if (text[j] === '\\') {
        j += 2;
        continue;
      }
      if (text[j] === '"') break;
      j++;
    }
    total += j - (idx + marker.length);
    idx = text.indexOf(marker, j);
  }
  return total;
}

function createBudgetTransform(opts: BudgetOptions): TransformStream<Uint8Array, Uint8Array> {
  const { userId, remainingBudget, inputTokens, upstreamModel, publicModelId } = opts;
  let pending = '';
  let outputChars = 0;
  let recorded = false;

  async function settle(): Promise<void> {
    if (recorded) return;
    recorded = true;
    const outputTokens = Math.ceil(outputChars / 4);
    const total = inputTokens + outputTokens;
    await recordUsage(userId, total);
  }

  function countContent(text: string): void {
    outputChars += countStreamContent(text);
  }

  function capChunk(controller: TransformStreamDefaultController<Uint8Array>): void {
    const consumed = Math.ceil(outputChars / 4);
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
        total_tokens:
          inputTokens + Math.min(Math.max(0, remainingBudget - inputTokens), consumed),
      },
    };
    controller.enqueue(enc.encode(`data: ${JSON.stringify(finalChunk)}\n\ndata: [DONE]\n\n`));
    controller.terminate();
  }

  function consumeComplete(controller: TransformStreamDefaultController<Uint8Array>): void {
    const lastBreak = pending.lastIndexOf('\n');
    if (lastBreak === -1) return;
    const complete = pending.slice(0, lastBreak + 1);
    pending = pending.slice(lastBreak + 1);
    const rewritten = rewriteModelName(complete, upstreamModel, publicModelId);
    countContent(rewritten);
    if (Math.ceil(outputChars / 4) >= remainingBudget) {
      capChunk(controller);
      return;
    }
    controller.enqueue(enc.encode(rewritten));
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      pending += dec.decode(chunk, { stream: true });
      while (!controller.desiredSize || controller.desiredSize > 0) {
        const before = pending.length;
        consumeComplete(controller);
        if (pending.length === before) break;
      }
    },
    async flush(controller) {
      if (pending) {
        const rewritten = rewriteModelName(pending, upstreamModel, publicModelId);
        countContent(rewritten);
        if (Math.ceil(outputChars / 4) < remainingBudget) {
          controller.enqueue(enc.encode(rewritten));
        }
        pending = '';
      }
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
  const conn = withConnectTimeout(signal);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...body, model: upstreamModel }),
      signal: conn.signal,
    });
  } catch (error) {
    conn.clear();
    if (signal.aborted) throw error;
    throw new UpstreamRequestError(502, 'Upstream request failed');
  }
  conn.clear();

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
  return Math.max(1, Math.ceil(chars / 4));
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
  const conn = withConnectTimeout(signal);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...body, model: upstreamModel }),
      signal: conn.signal,
    });
  } catch (error) {
    conn.clear();
    if (signal.aborted) throw error;
    throw new UpstreamRequestError(502, 'Upstream request failed');
  }
  conn.clear();
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

export async function imagesEdits(opts: ImagesCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, body, signal, userId } = opts;
  const url = `${baseUrl}/images/edits`;
  const conn = withConnectTimeout(signal);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...body, model: upstreamModel }),
      signal: conn.signal,
    });
  } catch (error) {
    conn.clear();
    if (signal.aborted) throw error;
    throw new UpstreamRequestError(502, 'Upstream request failed');
  }
  conn.clear();
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
