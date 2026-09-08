import { checkPublicRateLimit, resolveApiCaller, trackingId } from '@/lib/public-access';
import { jsonErrorCors } from '@/lib/http';
import { getCatalogModelProviders } from '@/lib/providers';
import { audioSpeech, UpstreamRequestError } from '@/lib/upstream';
import { cycleProviderPipes } from '@/lib/provider-cycle';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const requestStart = Date.now();
  const caller = await resolveApiCaller(req);
  if (!caller) return jsonErrorCors(401, 'Invalid API key. Use the public key from the Docs page.');
  const limited = checkPublicRateLimit(caller);
  if (limited) return jsonErrorCors(429, limited, 'rate_limit');
  const trackId = trackingId(caller);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.model !== 'string' || typeof body.input !== 'string') {
    return jsonErrorCors(400, 'Request body must include "model" and "input"');
  }
  const modelId = body.model;

  const controller = new AbortController();
  req.signal.addEventListener('abort', () => controller.abort());
  const signal = controller.signal;

  const ttsPipes = (await getCatalogModelProviders(modelId)).filter((e) => e.type === 'tts');
  if (ttsPipes.length > 0) {
    return cycleProviderPipes({
      pipes: ttsPipes,
      requestStart,
      budgetMs: 110000,
      call: (pipe) =>
        audioSpeech({
          baseUrl: pipe.baseUrl,
          apiKey: pipe.apiKey,
          upstreamModel: pipe.upstreamModel,
          publicModelId: pipe.id,
          body,
          signal,
          userId: trackId,
        }),
    });
  }

  return jsonErrorCors(404, `Model "${modelId}" not found`);
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
