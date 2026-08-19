import { IMAGE_TOKEN_COST, UpstreamRequestError, estimateTextTokens } from './upstream';
import { recordUsage } from './usage';

const HORDE_BASE = 'https://aihorde.net';
const HORDE_TIMEOUT_MS = 30_000;

function hordeHeaders(): Record<string, string> {
  return {
    apikey: process.env.AI_HORDE_API_KEY ?? '0000000000',
    'Client-Agent': 'NextRouter/1.0',
    accept: 'application/json',
  };
}

interface HordeTextStatus {
  done?: boolean;
  generations?: Array<{ text?: string }>;
}

interface HordeImageStatus {
  done?: boolean;
  generations?: Array<{ img?: string }>;
}

async function pollHorde<T>(url: string, signal: AbortSignal): Promise<T | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < HORDE_TIMEOUT_MS) {
    const res = await fetch(url, { headers: hordeHeaders(), signal }).catch(() => null);
    if (res && res.ok) {
      const payload = (await res.json().catch(() => null)) as T | null;
      if (payload) {
        const done = (payload as { done?: boolean }).done;
        if (done === true) return payload;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return null;
}

function messagesToPrompt(messages: Array<Record<string, unknown>>): string {
  let prompt = '';
  for (const message of messages) {
    const role =
      message.role === 'assistant'
        ? 'assistant'
        : message.role === 'system'
          ? 'system'
          : 'user';
    const content = typeof message.content === 'string' ? message.content : '';
    prompt += `<|im_start|>${role}\n${content}<|im_end|>\n`;
  }
  prompt += '<|im_start|>assistant\n';
  return prompt;
}

export interface HordeTextOptions {
  upstreamModel: string;
  publicModelId: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
  userId: string;
}

export async function hordeTextCompletion(opts: HordeTextOptions): Promise<Response> {
  const { upstreamModel, publicModelId, body, signal, userId } = opts;
  const messages = (body.messages as Array<Record<string, unknown>> | undefined) ?? [];
  const prompt = messagesToPrompt(messages);
  const maxLength = typeof body.max_tokens === 'number' ? body.max_tokens : 512;
  const params: Record<string, unknown> = {
    max_length: Math.min(2048, Math.max(16, Math.round(maxLength))),
    max_context_length: 2048,
  };
  if (typeof body.temperature === 'number') params.temperature = body.temperature;
  if (typeof body.top_p === 'number') params.top_p = body.top_p;

  const created = await fetch(`${HORDE_BASE}/api/v2/generate/text/async`, {
    method: 'POST',
    headers: { ...hordeHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, params, models: [upstreamModel] }),
    signal,
  }).catch(() => {
    throw new UpstreamRequestError(502, 'Upstream request failed');
  });
  if (!created.ok) {
    throw new UpstreamRequestError(502, 'Upstream request failed');
  }
  const createdJson = (await created.json().catch(() => null)) as { id?: string } | null;
  if (!createdJson?.id) {
    throw new UpstreamRequestError(502, 'Upstream returned an invalid response');
  }

  const status = await pollHorde<HordeTextStatus>(
    `${HORDE_BASE}/api/v2/generate/text/status/${createdJson.id}`,
    signal,
  );
  if (!status) {
    // record a partial completion (input only) — the user still burned budget
    await recordUsage(userId, estimateTextTokens(prompt));
    throw new UpstreamRequestError(504, 'Upstream generation timed out');
  }

  const text = status.generations?.[0]?.text ?? '';
  const promptTokens = estimateTextTokens(prompt);
  const completionTokens = estimateTextTokens(text);
  await recordUsage(userId, promptTokens + completionTokens);

  return Response.json(
    {
      id: `chatcmpl-${createdJson.id}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: publicModelId,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    },
    { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}

export interface HordeImageOptions {
  upstreamModel: string;
  publicModelId: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
  userId: string;
}

function parseImageSize(raw: unknown): { width: number; height: number } {
  if (typeof raw === 'string') {
    const match = raw.toLowerCase().match(/^(\d+)x(\d+)$/);
    if (match) {
      const width = Math.min(2048, Math.max(64, Number(match[1])));
      const height = Math.min(2048, Math.max(64, Number(match[2])));
      return { width, height };
    }
  }
  return { width: 1024, height: 1024 };
}

export async function hordeImageGeneration(opts: HordeImageOptions): Promise<Response> {
  const { upstreamModel, publicModelId, body, signal, userId } = opts;
  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt) {
    throw new UpstreamRequestError(400, 'prompt is required');
  }
  const { width, height } = parseImageSize(body.size);
  const n = typeof body.n === 'number' ? Math.min(8, Math.max(1, Math.ceil(body.n))) : 1;
  const params: Record<string, unknown> = {
    width,
    height,
    steps: typeof body.steps === 'number' ? Math.min(50, Math.max(1, Math.round(body.steps))) : 20,
    n,
    cfg_scale: typeof body.cfg_scale === 'number' ? body.cfg_scale : 7,
  };

  const created = await fetch(`${HORDE_BASE}/api/v2/generate/async`, {
    method: 'POST',
    headers: { ...hordeHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, params, models: [upstreamModel] }),
    signal,
  }).catch(() => {
    throw new UpstreamRequestError(502, 'Upstream request failed');
  });
  if (!created.ok) {
    throw new UpstreamRequestError(502, 'Upstream request failed');
  }
  const createdJson = (await created.json().catch(() => null)) as { id?: string } | null;
  if (!createdJson?.id) {
    throw new UpstreamRequestError(502, 'Upstream returned an invalid response');
  }

  const status = await pollHorde<HordeImageStatus>(
    `${HORDE_BASE}/api/v2/generate/status/${createdJson.id}`,
    signal,
  );
  if (!status) {
    throw new UpstreamRequestError(504, 'Upstream generation timed out');
  }

  const images = (status.generations ?? []).map((generation) => ({ b64_json: generation.img ?? '' }));
  await recordUsage(userId, n * IMAGE_TOKEN_COST);

  return Response.json(
    {
      created: Math.floor(Date.now() / 1000),
      data: images,
    },
    { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}