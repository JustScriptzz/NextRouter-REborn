// Anthropic Messages API compatibility — /v1/messages.
//
// Native Anthropic clients (anthropic SDK, claude-shaped presets) work
// unmodified: `x-api-key` header, Anthropic body shape (system as a
// separate field, content as string or block array), Anthropic response
// shape and SSE event stream on the way back.
//
// Translation: Anthropic request → OpenAI chat completions → the same
// gateway pipeline (keys, failover, usage) → Anthropic response.

import { getUserFromApiKey } from '@/lib/auth';
import { CORS_HEADERS } from '@/lib/http';
// Direct in-isolate call — a worker self-fetch over HTTPS never reaches the
// chat route (edge 404), so we invoke its handler with a synthetic request.
import { POST as chatCompletionsPOST } from '../chat/completions/route';

export const runtime = 'nodejs';

interface AnthropicBlock {
  type: string;
  text?: string;
  [k: string]: unknown;
}

interface AnthropicMsg {
  role: 'user' | 'assistant';
  content: string | AnthropicBlock[];
}

function flattenContent(content: string | AnthropicBlock[] | undefined | null): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((b) => (b && typeof b.text === 'string' ? b.text : ''))
    .join('\n')
    .trim();
}

function anthropicError(status: number, type: string, message: string): Response {
  return Response.json(
    { type: 'error', error: { type, message } },
    { status, headers: CORS_HEADERS },
  );
}

function errorTypeFor(status: number): string {
  if (status === 401) return 'authentication_error';
  if (status === 403) return 'permission_error';
  if (status === 404) return 'not_found_error';
  if (status === 429) return 'rate_limit_error';
  if (status >= 500) return 'api_error';
  return 'invalid_request_error';
}

export async function POST(req: Request) {
  const xKey = (req.headers.get('x-api-key') ?? '').trim();
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const key = xKey || bearer;
  if (!key) {
    return anthropicError(
      401,
      'authentication_error',
      'Missing API key. Pass it as the x-api-key header (or Authorization: Bearer).',
    );
  }
  const user = await getUserFromApiKey(`Bearer ${key}`);
  if (!user) return anthropicError(401, 'authentication_error', 'Invalid or revoked API key.');

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.model !== 'string' || !Array.isArray(body.messages)) {
    return anthropicError(400, 'invalid_request_error', 'Body must include "model" and "messages".');
  }
  const maxTokens = body.max_tokens;
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    return anthropicError(400, 'invalid_request_error', '"max_tokens" is required and must be a positive number.');
  }

  // --- translate messages: Anthropic → OpenAI ---
  const msgs: Array<{ role: string; content: string }> = [];
  const system = flattenContent(
    typeof body.system === 'string'
      ? body.system
      : Array.isArray(body.system)
        ? (body.system as AnthropicBlock[])
        : null,
  );
  if (system) msgs.push({ role: 'system', content: system });
  for (const m of body.messages as AnthropicMsg[]) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const c = flattenContent(m.content);
    if (!c) continue;
    msgs.push({ role: m.role, content: c });
  }
  if (msgs.length === 0) {
    return anthropicError(400, 'invalid_request_error', 'No usable messages after translation.');
  }

  const openaiBody: Record<string, unknown> = {
    model: body.model,
    messages: msgs,
    max_tokens: maxTokens,
    stream: body.stream === true,
  };
  if (typeof body.temperature === 'number') openaiBody.temperature = body.temperature;
  if (typeof body.top_p === 'number') openaiBody.top_p = body.top_p;
  if (body.stop_sequences !== undefined) openaiBody.stop = body.stop_sequences;
  if (body.tools !== undefined) openaiBody.tools = body.tools;
  if (body.tool_choice !== undefined) openaiBody.tool_choice = body.tool_choice;

  const wantsStream = body.stream === true;

  let upstream: Response;
  try {
    upstream = await chatCompletionsPOST(
      new Request('http://internal/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(openaiBody),
      }),
    );
  } catch {
    return anthropicError(502, 'api_error', 'Gateway unreachable — try again.');
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    let message = 'Upstream request failed';
    try {
      const j = JSON.parse(errText) as { error?: { message?: string } | string };
      message = typeof j?.error === 'string' ? j.error : j?.error?.message ?? message;
    } catch {
      /* keep default */
    }
    return anthropicError(upstream.status, errorTypeFor(upstream.status), message);
  }

  const model = body.model;

  if (wantsStream) {
    const reader = upstream.body?.getReader();
    if (!reader) return anthropicError(502, 'api_error', 'No stream body from upstream.');
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const msgId = `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let started = false;
        let inputTokens = 0;
        let outputTokens = 0;
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        try {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              let chunk: {
                choices?: Array<{ delta?: { content?: string }; usage?: { prompt_tokens?: number; completion_tokens?: number } }>;
                usage?: { prompt_tokens?: number; completion_tokens?: number };
              } | null = null;
              try {
                chunk = JSON.parse(data);
              } catch {
                continue;
              }
              if (chunk?.usage) {
                inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
                outputTokens = chunk.usage.completion_tokens ?? outputTokens;
              }
              const text = chunk?.choices?.[0]?.delta?.content;
              if (!text) continue;
              if (!started) {
                started = true;
                send('message_start', {
                  type: 'message_start',
                  message: {
                    id: msgId,
                    type: 'message',
                    role: 'assistant',
                    model,
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
              }
              outputTokens += Math.ceil(text.length / 4);
              send('content_block_delta', {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text },
              });
            }
          }
          if (!started) {
            // Stream produced nothing usable — emit an empty message so the
            // client sees a valid lifecycle instead of hanging.
            send('message_start', {
              type: 'message_start',
              message: {
                id: msgId,
                type: 'message',
                role: 'assistant',
                model,
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
          }
          send('content_block_stop', { type: 'content_block_stop', index: 0 });
          send('message_delta', {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: Math.max(1, outputTokens) },
          });
          send('message_stop', { type: 'message_stop' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // --- non-streaming: OpenAI JSON → Anthropic message ---
  const j = (await upstream.json().catch(() => null)) as {
    id?: string;
    choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;
  const choice = j?.choices?.[0];
  const text = choice?.message?.content ?? '';
  const finish = choice?.finish_reason;
  return Response.json(
    {
      id: j?.id ?? `msg_${Date.now().toString(36)}`,
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text }],
      stop_reason: finish === 'length' ? 'max_tokens' : 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: j?.usage?.prompt_tokens ?? 0,
        output_tokens: j?.usage?.completion_tokens ?? 0,
      },
    },
    { status: 200, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-api-key, anthropic-version' },
  });
}
