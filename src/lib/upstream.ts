import type { ModelKind } from './types';
import { recordUsage } from './usage';
import { recordModelResult } from './model-stats';
import { proxiedFetch } from './proxy-pool';

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
    '/embeddings',
    '/models',
  ];
  if (suffixes.some((s) => trimmed.endsWith(s))) {
    for (const s of suffixes) {
      if (trimmed.endsWith(s)) return trimmed.slice(0, trimmed.length - s.length);
    }
  }
  return `${trimmed}/v1`;
}

function joinEndpoint(baseUrl: string, path: string): string {
  const base = stripTrailingSlashes(baseUrl.trim());
  if (base.endsWith(`/${path}`)) return base;
  return `${base}/${path}`;
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

const UPSTREAM_ATTEMPT_TIMEOUT_MS = 60000;

function withAttemptTimeout(signal: AbortSignal): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const composite = AbortSignal.any([signal, controller.signal]);
  const timer = setTimeout(() => controller.abort(), UPSTREAM_ATTEMPT_TIMEOUT_MS);
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

export function estimateEmbeddingInputTokens(body: Record<string, unknown>): number {
  const input = body.input;
  let chars = 0;
  if (typeof input === 'string') {
    chars = input.length;
  } else if (Array.isArray(input)) {
    for (const part of input) {
      if (typeof part === 'string') chars += part.length;
    }
  }
  return Math.max(1, Math.ceil(chars / 4));
}

function scrubUpstreamMessage(message: string): string {
  const urlPattern = new RegExp('https?:\\/\\/\\S+', 'g');
  return message.replace(urlPattern, '').slice(0, 500);
}

function sanitizeChatBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  if (!Array.isArray(out.tools) || out.tools.length === 0) {
    delete out.tools;
    delete out.tool_choice;
  }
  delete out.parallel_tool_calls;
  delete out.response_format;
  delete (out as Record<string, unknown>).logit_bias;
  delete (out as Record<string, unknown>).logprobs;
  delete (out as Record<string, unknown>).top_logprobs;
  if (typeof out.temperature !== 'number' || !Number.isFinite(out.temperature)) delete out.temperature;
  if (typeof out.top_p !== 'number' || !Number.isFinite(out.top_p)) delete out.top_p;
  const mt = out.max_tokens as unknown;
  if (mt !== undefined && (!Number.isInteger(mt as number) || (mt as number) <= 0)) delete out.max_tokens;
  const mct = (out as Record<string, unknown>).max_completion_tokens as unknown;
  if (mct !== undefined && (!Number.isInteger(mct as number) || (mct as number) <= 0)) {
    delete (out as Record<string, unknown>).max_completion_tokens;
  }
  return out;
}

function getMessageReasoning(msg: Record<string, unknown>): string {
  if (typeof msg.reasoning === 'string' && msg.reasoning) return msg.reasoning;
  const rc = (msg as Record<string, unknown>).reasoning_content;
  if (typeof rc === 'string' && rc) return rc;
  const th = (msg as Record<string, unknown>).thinking;
  if (typeof th === 'string' && th) return th;
  return '';
}

function normalizeReasoningMessage(data: Record<string, unknown>): Record<string, unknown> {
  try {
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
    if (msg && typeof msg.reasoning !== 'string') {
      const r = getMessageReasoning(msg);
      if (r) msg.reasoning = r;
    }
  } catch {
    /* keep original */
  }
  return data;
}

function clientRequestedThinking(body: Record<string, unknown>): boolean {
  if ((body as Record<string, unknown>).include_reasoning === true) return true;
  if ((body as Record<string, unknown>).reasoning_effort !== undefined) return true;
  if ((body as Record<string, unknown>).reasoning !== undefined) return true;
  const th = (body as Record<string, unknown>).thinking as unknown;
  if (th && typeof th === 'object' && (th as Record<string, unknown>).type === 'enabled') return true;
  return false;
}

function injectThinkingPrompt(bodyToSend: Record<string, unknown>): Record<string, unknown> {
  const instruction =
    'Think step-by-step inside <thinking>...</thinking> tags first, then give your final answer outside the tags. Keep the thinking concise but show your reasoning.';
  const messages = (bodyToSend.messages as Array<Record<string, unknown>> | undefined) ?? [];
  const out = messages.map((m) => ({ ...m }));
  const sysIdx = out.findIndex((m) => m.role === 'system');
  if (sysIdx >= 0) {
    const existing = typeof out[sysIdx].content === 'string' ? (out[sysIdx].content as string) : '';
    out[sysIdx] = { ...out[sysIdx], content: existing ? `${existing}\n\n${instruction}` : instruction };
  } else {
    out.unshift({ role: 'system', content: instruction });
  }
  const next: Record<string, unknown> = { ...bodyToSend, messages: out };
  delete (next as Record<string, unknown>).thinking;
  return next;
}

function extractManualThinking(content: string): { reasoning: string; content: string } {
  const m = content.match(/<thinking>([\s\S]*?)<\/thinking>/i) ?? content.match(/<think>([\s\S]*?)<\/think>/i);
  if (m) {
    return { reasoning: m[1].trim(), content: content.replace(m[0], '').trim() };
  }
  return { reasoning: '', content };
}

// Models with no native function-calling on their gateways — skip the native
// attempt entirely and go straight to prompt-injection emulation.
function shouldForceToolEmulation(publicModelId: string): boolean {
  const id = publicModelId.toLowerCase();
  return id.includes('sonnet-5') || id.includes('claude-5') || id.includes('sonnet-4.5');
}

function toolChoiceDemandsCall(body: Record<string, unknown>): boolean {
  const tc = (body as Record<string, unknown>).tool_choice as unknown;
  if (tc === 'required') return true;
  if (tc && typeof tc === 'object' && 'function' in (tc as Record<string, unknown>)) return true;
  return false;
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
  startedAt?: number;
  hasEmulatedTools?: boolean;
  emulatedTools?: Array<{ type: string; function: { name: string; description?: string; parameters?: unknown } }>;
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
  const startedAt = opts.startedAt ?? Date.now();
  const hasEmulatedTools = !!opts.hasEmulatedTools;
  const emulatedTools = opts.emulatedTools ?? [];
  let pending = '';
  let outputChars = 0;
  let recorded = false;
  let emulatedContentAccum = '';

  async function settle(): Promise<void> {
    if (recorded) return;
    recorded = true;
    const outputTokens = Math.ceil(outputChars / 4);
    const total = inputTokens + outputTokens;
    await recordUsage(userId, total);
    recordModelResult(publicModelId, true, Date.now() - startedAt, outputTokens, Date.now() - startedAt);
  }

  function countContent(text: string): void {
    outputChars += countStreamContent(text);
  }

  function extractContentDeltas(sseText: string): string {
    let acc = '';
    const lines = sseText.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload) as Record<string, unknown>;
        const delta = (j.choices as Array<Record<string, unknown>> | undefined)?.[0]?.delta as Record<string, unknown> | undefined;
        if (delta && typeof delta.content === 'string') acc += delta.content as string;
      } catch {}
    }
    return acc;
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
    if (hasEmulatedTools) {
      emulatedContentAccum += extractContentDeltas(rewritten);
      countContent(rewritten);
      if (Math.ceil(outputChars / 4) >= remainingBudget) {
        capChunk(controller);
      }
      return;
    }
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
      if (hasEmulatedTools) {
        if (pending) {
          const rewritten = rewriteModelName(pending, upstreamModel, publicModelId);
          emulatedContentAccum += extractContentDeltas(rewritten);
          countContent(rewritten);
          pending = '';
        }
        // Try to parse accumulated content as tool calls
        if (emulatedContentAccum.trim()) {
          try {
            const { tryParseToolCalls } = await import('./tool-emulation');
            const parsed = tryParseToolCalls(emulatedContentAccum, emulatedTools as never);
            if (parsed && parsed.length > 0) {
              // Emit as tool_calls instead of content
              for (let i = 0; i < parsed.length; i++) {
                const tc = parsed[i];
                const toolChunk = {
                  id: `chatcmpl-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: publicModelId,
                  choices: [
                    {
                      index: 0,
                      delta: { role: 'assistant', content: null, tool_calls: [{ index: i, id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments } }] },
                      finish_reason: null,
                    },
                  ],
                };
                controller.enqueue(enc.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
              }
              const doneChunk = {
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: publicModelId,
                choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
              };
              controller.enqueue(enc.encode(`data: ${JSON.stringify(doneChunk)}\n\ndata: [DONE]\n\n`));
              await settle();
              return;
            }
          } catch {}
        }
        // No tool calls detected — emit as normal content
        if (emulatedContentAccum) {
          const contentChunk = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: publicModelId,
            choices: [{ index: 0, delta: { role: 'assistant', content: emulatedContentAccum }, finish_reason: null }],
          };
          controller.enqueue(enc.encode(`data: ${JSON.stringify(contentChunk)}\n\n`));
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
        } else {
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
        }
        await settle();
        return;
      }
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

async function peekSseForUpstreamError(
  stream: ReadableStream<Uint8Array>,
): Promise<ReadableStream<Uint8Array> | null> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';

  for (;;) {
    const lines = pending.split('\n');
    let verdict: 'ok' | 'none' = 'none';
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          void reader.cancel().catch(() => undefined);
          return null;
        }
      } catch {
        /* not json */
      }
      verdict = 'ok';
      break;
    }
    if (verdict === 'ok') break;

    const { done, value } = await reader.read();
    if (done) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    pending += decoder.decode(value, { stream: true });
  }

  const leftover = pending;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(leftover));
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

async function doChatFetch(
  opts: ChatCallOptions,
  bodyToSend: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel } = opts;
  const url = joinEndpoint(baseUrl, 'chat/completions');
  const conn = withAttemptTimeout(signal);
  let upstream: Response;
  const sanitized = sanitizeChatBody(bodyToSend);
  if ((sanitized as Record<string, unknown>).include_reasoning === undefined) {
    (sanitized as Record<string, unknown>).include_reasoning = true;
  }
  try {
    upstream = await proxiedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...sanitized, model: upstreamModel }),
      signal: conn.signal,
    });
  } catch (error) {
    conn.clear();
    if (signal.aborted) throw error;
    throw new UpstreamRequestError(502, 'Upstream request failed');
  }
  conn.clear();
  return upstream;
}

export async function chatCompletions(opts: ChatCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, body, signal, userId, remainingBudget } = opts;

  const { hasTools, injectToolsIntoMessages, tryParseToolCalls, isToolNotSupportedError, convertEmulatedResponse } =
    await import('./tool-emulation');

  const originalHasTools = hasTools(body);
  const originalTools = originalHasTools ? (body.tools as Array<{ type: string; function: { name: string; description?: string; parameters?: unknown } }>) : [];

  // Helper to handle a successful non-streaming response: check for emulated tool calls in content or reasoning
  function maybeConvertEmulated(data: Record<string, unknown>): Record<string, unknown> {
    if (!originalHasTools) return normalizeReasoningMessage(data);
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
    if (!msg || msg.tool_calls) return normalizeReasoningMessage(data);
    const content = typeof msg.content === 'string' ? msg.content : '';
    const reasoning = getMessageReasoning(msg);
    const candidate = content || reasoning || '';
    if (!candidate) return data;
    // Try content first, then reasoning, then combined
    let parsed = tryParseToolCalls(candidate, originalTools);
    if (!parsed && reasoning && content !== reasoning) {
      parsed = tryParseToolCalls(reasoning, originalTools) || tryParseToolCalls(content + '\n' + reasoning, originalTools);
    }
    if (!parsed) return data;
    return convertEmulatedResponse(data, parsed, publicModelId);
  }

  const startedAt = Date.now();
  let upstream: Response;
  let usedEmulation = false;
  let bodyToSend: Record<string, unknown> = body;

  const { applyIdentityInjection } = await import('./identity-inject');
  bodyToSend = applyIdentityInjection(bodyToSend, publicModelId, baseUrl);

  // Thinking is always on for non-streaming chats: ask for <thinking> upfront
  // so it's a single call, then split it into reasoning + content below.
  // Streaming stays native-only to preserve token-by-token deltas.
  if (body.stream !== true) {
    bodyToSend = injectThinkingPrompt(bodyToSend);
  }

  // Tool calling is always emulated via prompt injection — native function-calling
  // proved unreliable across these free gateways, so skip the native attempt
  // entirely whenever tools are present.
  if (originalHasTools) {
    const { injectIdentity } = await import('./identity-inject');
    const withTools = injectToolsIntoMessages(bodyToSend);
    const emBody = { ...withTools, messages: injectIdentity(withTools.messages as Array<Record<string, unknown>>, publicModelId) };
    bodyToSend = emBody;
    usedEmulation = true;
    upstream = await doChatFetch(opts, emBody, signal);
  } else {
    upstream = await doChatFetch(opts, bodyToSend, signal);
  }

  // If native tool support failed, retry with emulation
  if (!upstream.ok && originalHasTools) {
    const clone = upstream.clone();
    const text = await clone.text().catch(() => '');
    let errMsg = '';
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      errMsg = parsed.error?.message ?? '';
    } catch {}
    if (isToolNotSupportedError(upstream.status, errMsg)) {
      const { injectIdentity } = await import('./identity-inject');
      const withTools = injectToolsIntoMessages(bodyToSend);
      const emBody = { ...withTools, messages: injectIdentity(withTools.messages as Array<Record<string, unknown>>, publicModelId) };
      bodyToSend = emBody;
      usedEmulation = true;
      upstream = await doChatFetch(opts, emBody, signal);
    }
  }

  // Gemini-style 400 (bad request on strict params): retry once sanitized,
  // converting system->user if the upstream complains about system role.
  if (!upstream.ok && upstream.status === 400 && !usedEmulation) {
    const clone = upstream.clone();
    const text = await clone.text().catch(() => '');
    const lower = text.toLowerCase();
    if (
      lower.includes('temperature') ||
      lower.includes('max_tokens') ||
      lower.includes('max_completion') ||
      lower.includes('system') ||
      lower.includes('tool') ||
      lower.includes('parallel') ||
      lower.includes('response_format') ||
      lower.includes('include_reasoning') ||
      lower.includes('reasoning') ||
      lower.includes('unknown') ||
      lower.includes('unexpected') ||
      lower.includes('invalid')
    ) {
      let retryBody: Record<string, unknown> = sanitizeChatBody(bodyToSend);
      delete (retryBody as Record<string, unknown>).include_reasoning;
      if (lower.includes('system') && Array.isArray(retryBody.messages)) {
        retryBody = {
          ...retryBody,
          messages: (retryBody.messages as Array<Record<string, unknown>>).map((m) =>
            m.role === 'system' ? { ...m, role: 'user' } : m,
          ),
        };
      }
      const retry = await doChatFetch(opts, retryBody, signal);
      if (retry.ok) {
        upstream = retry;
        bodyToSend = retryBody;
      }
    }
  }

  if (!upstream.ok) {
    return upstreamErrorResponse(upstream);
  }

  const effectiveBody = usedEmulation ? bodyToSend : body;
  const inputTokens = estimateChatInputTokens(effectiveBody);

  if (body.stream === true) {
    const stream = upstream.body;
    if (!stream) {
      throw new UpstreamRequestError(502, 'Upstream returned no stream');
    }
    const guarded = await peekSseForUpstreamError(stream);
    if (!guarded) {
      throw new UpstreamRequestError(503, 'Service temporarily unavailable');
    }
    const counted = guarded.pipeThrough(
      createBudgetTransform({
        userId,
        remainingBudget,
        inputTokens,
        upstreamModel,
        publicModelId,
        startedAt,
        hasEmulatedTools: usedEmulation,
        emulatedTools: originalTools,
      }),
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
  // Native succeeded but ignored a mandatory tool request — retry once emulated.
  if (originalHasTools && !usedEmulation && toolChoiceDemandsCall(body)) {
    const msg0 = (data.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as
      | Record<string, unknown>
      | undefined;
    if (msg0 && !(msg0 as Record<string, unknown>).tool_calls) {
      try {
        const { injectIdentity } = await import('./identity-inject');
        const withTools = injectToolsIntoMessages(bodyToSend);
        const emBody = { ...withTools, messages: injectIdentity(withTools.messages as Array<Record<string, unknown>>, publicModelId) };
        const emRes = await doChatFetch(opts, emBody, signal);
        if (emRes.ok) {
          const emData = (await emRes.json().catch(() => null)) as Record<string, unknown> | null;
          if (emData) {
            bodyToSend = emBody;
            usedEmulation = true;
            let emRewritten = normalizeReasoningMessage(rewriteModelField(emData, upstreamModel, publicModelId));
            emRewritten = maybeConvertEmulated(emRewritten);
            const emTokens =
              typeof (emRewritten as { usage?: { completion_tokens?: unknown } }).usage?.completion_tokens === 'number'
                ? (emRewritten as { usage: { completion_tokens: number } }).usage.completion_tokens
                : estimateChatOutputTokens(emRewritten);
            recordModelResult(publicModelId, true, Date.now() - startedAt, emTokens, Date.now() - startedAt);
            await recordUsage(userId, inputTokens + emTokens);
            return Response.json(emRewritten, {
              status: 200,
              headers: { 'Access-Control-Allow-Origin': '*' },
            });
          }
        }
      } catch {
        /* fall through to native response */
      }
    }
  }
  let rewritten = rewriteModelField(data, upstreamModel, publicModelId);
  rewritten = normalizeReasoningMessage(rewritten);
  // If we used emulation or native returned content that looks like tool calls, convert
  if (originalHasTools) {
    rewritten = maybeConvertEmulated(rewritten);
  }
  // Thinking was requested upfront for non-streaming: split any <thinking>
  // tags into reasoning + clean content (single call, no retry).
  {
    const msg = (rewritten.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as
      | Record<string, unknown>
      | undefined;
    if (msg && typeof msg.content === 'string' && !getMessageReasoning(msg)) {
      const split = extractManualThinking(msg.content);
      if (split.reasoning) {
        msg.reasoning = split.reasoning;
        msg.content = split.content || msg.content;
      }
    }
  }
  const outputTokens =
    typeof (rewritten as { usage?: { completion_tokens?: unknown } }).usage?.completion_tokens === 'number'
      ? (rewritten as { usage: { completion_tokens: number } }).usage.completion_tokens
      : estimateChatOutputTokens(rewritten);
  recordModelResult(publicModelId, true, Date.now() - startedAt, outputTokens, Date.now() - startedAt);
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
      const reasoning = getMessageReasoning(message);
      if (reasoning) chars += reasoning.length;
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
  const url = joinEndpoint(baseUrl, 'images/generations');
  const conn = withAttemptTimeout(signal);
  let upstream: Response;
  try {
    upstream = await proxiedFetch(url, {
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

export interface VideosCallOptions {
  baseUrl: string;
  apiKey: string;
  upstreamModel: string;
  publicModelId: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
  userId: string;
}

export const VIDEO_TOKEN_COST = 2000;

export async function videosGenerations(opts: VideosCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, body, signal, userId } = opts;
  const url = joinEndpoint(baseUrl, 'videos/generations');
  const conn = withAttemptTimeout(signal);
  let upstream: Response;
  try {
    upstream = await proxiedFetch(url, {
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
  const rewritten = rewriteModelField(data, upstreamModel, publicModelId);
  // Video generation is more expensive — charge per generation request
  await recordUsage(userId, VIDEO_TOKEN_COST);
  return Response.json(rewritten, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

export async function imagesEdits(opts: ImagesCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, body, signal, userId } = opts;
  const url = joinEndpoint(baseUrl, 'images/edits');
  const conn = withAttemptTimeout(signal);
  let upstream: Response;
  try {
    upstream = await proxiedFetch(url, {
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
  const url = joinEndpoint(baseUrl, 'audio/speech');
  const conn = withAttemptTimeout(signal);
  let upstream: Response;
  try {
    upstream = await proxiedFetch(url, {
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

export interface TranscriptionCallOptions {
  baseUrl: string;
  apiKey: string;
  upstreamModel: string;
  publicModelId: string;
  signal: AbortSignal;
  userId: string;
  formData: FormData;
}

export async function audioTranscriptions(opts: TranscriptionCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, signal, userId, formData } = opts;
  const url = joinEndpoint(baseUrl, 'audio/transcriptions');
  formData.set('model', upstreamModel);
  const conn = withAttemptTimeout(signal);
  let upstream: Response;
  try {
    upstream = await proxiedFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
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
  await recordUsage(userId, 1000);
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export interface EmbeddingsCallOptions {
  baseUrl: string;
  apiKey: string;
  upstreamModel: string;
  publicModelId: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
  userId: string;
}

export async function embeddingsCall(opts: EmbeddingsCallOptions): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel, publicModelId, body, signal, userId } = opts;
  const url = joinEndpoint(baseUrl, 'embeddings');
  const conn = withAttemptTimeout(signal);
  let upstream: Response;
  try {
    upstream = await proxiedFetch(url, {
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
  const rewritten = rewriteModelField(data, upstreamModel, publicModelId);
  await recordUsage(userId, estimateEmbeddingInputTokens(body));
  return Response.json(rewritten, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}
