import { getUserFromApiKey } from '@/lib/auth';
import { jsonErrorCors } from '@/lib/http';
import { getCatalogModelProviders } from '@/lib/providers';
import { audioTranscriptions } from '@/lib/upstream';
import { cycleProviderPipes } from '@/lib/provider-cycle';
import { getUsageRemaining, isUnlimitedEmail, UNLIMITED_BUDGET } from '@/lib/usage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const requestStart = Date.now();
  const user = await getUserFromApiKey(req.headers.get('authorization'));
  if (!user) return jsonErrorCors(401, 'Missing or invalid API key');

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonErrorCors(400, 'Request must be multipart form data with a "file" field');
  }
  if (!formData.has('file')) {
    return jsonErrorCors(400, 'Form data must include a "file" field');
  }

  const modelId = formData.get('model');
  if (typeof modelId !== 'string' || !modelId) {
    return jsonErrorCors(400, 'Form data must include a "model" field');
  }

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

  const sttPipes = (await getCatalogModelProviders(modelId)).filter((e) => e.type === 'stt');
  if (sttPipes.length > 0) {
    return cycleProviderPipes({
      pipes: sttPipes,
      requestStart,
      budgetMs: 110000,
      call: (pipe) =>
        audioTranscriptions({
          baseUrl: pipe.baseUrl,
          apiKey: pipe.apiKey,
          upstreamModel: pipe.upstreamModel,
          publicModelId: pipe.id,
          signal,
          userId: user.id,
          formData,
        }),
    });
  }

  return jsonErrorCors(404, `Model "${modelId}" not found`);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
}

export const maxDuration = 150;
