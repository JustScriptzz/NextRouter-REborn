import { getUserFromApiKey } from '@/lib/auth';
import { jsonErrorCors } from '@/lib/http';
import { getCatalogModelProviders } from '@/lib/providers';
import { audioSpeech } from '@/lib/upstream';
import { cycleProviderPipes } from '@/lib/provider-cycle';
import { getUsageRemaining, isUnlimitedEmail, UNLIMITED_BUDGET } from '@/lib/usage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const requestStart = Date.now();
  const user = await getUserFromApiKey(req.headers.get('authorization'));
  if (!user) return jsonErrorCors(401, 'Missing or invalid API key');

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.model !== 'string' || typeof body.input !== 'string') {
    return jsonErrorCors(400, 'Request body must include "model" and "input"');
  }
  const modelId = body.model;

  const unlimited = isUnlimitedEmail(user.email);
  const remaining = unlimited ? UNLIMITED_BUDGET : await getUsageRemaining(user.id);
  if (remaining <= 0) {
    return jsonErrorCors(
      429,
      'Daily token limit of 500000 tokens reached. It resets at midnight UTC.',
      'daily_limit',
    );
  }

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
          userId: user.id,
        }),
    });
  }

  return jsonErrorCors(404, `Model "${modelId}" not found`);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
}

export const maxDuration = 150;
