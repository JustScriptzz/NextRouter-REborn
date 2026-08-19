import { getSessionUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { withV1Prefix } from '@/lib/upstream';

export const runtime = 'nodejs';

const TIMEOUT_MS = 20000;

function makeSilentWavBuffer(): Uint8Array<ArrayBuffer> {
  const sampleRate = 8000;
  const seconds = 1;
  const dataSize = sampleRate * seconds * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  return new Uint8Array(buffer);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');

  const body = (await req.json().catch(() => null)) as {
    endpointUrl?: unknown;
    bearerToken?: unknown;
    providerModelId?: unknown;
    type?: unknown;
  } | null;
  if (!body || typeof body.endpointUrl !== 'string' || typeof body.providerModelId !== 'string') {
    return jsonError(400, 'endpointUrl and providerModelId are required');
  }
  const endpointUrl = body.endpointUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(endpointUrl)) return jsonError(400, 'Endpoint URL must be http(s)');
  const token = typeof body.bearerToken === 'string' ? body.bearerToken : '';
  const type = typeof body.type === 'string' ? body.type : 'text';
  const base = withV1Prefix(endpointUrl);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    let ok = false;
    switch (type) {
      case 'text':
      case 'video': {
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: body.providerModelId,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 8,
          }),
          signal: controller.signal,
        });
        ok = res.ok;
        break;
      }
      case 'image': {
        const res = await fetch(`${base}/images/generations`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: body.providerModelId,
            prompt: 'test',
            n: 1,
            size: '256x256',
          }),
          signal: controller.signal,
        });
        ok = res.ok;
        break;
      }
      case 'tts': {
        const res = await fetch(`${base}/audio/speech`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: body.providerModelId,
            input: 'test',
            voice: 'alloy',
          }),
          signal: controller.signal,
        });
        ok = res.ok;
        break;
      }
      case 'stt': {
        const formData = new FormData();
        formData.set('model', body.providerModelId);
        formData.set(
          'file',
          new Blob([makeSilentWavBuffer()], { type: 'audio/wav' }),
          'test.wav',
        );
        const res = await fetch(`${base}/audio/transcriptions`, {
          method: 'POST',
          headers,
          body: formData,
          signal: controller.signal,
        });
        ok = res.ok;
        break;
      }
      default:
        return jsonError(400, 'Unknown input type');
    }

    if (!ok) {
      return jsonError(422, `The endpoint responded with an error (${Date.now() - startedAt}ms). Check the model ID and API token.`);
    }
    const latency = Date.now() - startedAt;
    return jsonOk({ ok: true, latencyMs: latency, message: 'Connected - the model responded' });
  } catch {
    return jsonError(502, 'Could not reach the endpoint or the request timed out');
  } finally {
    clearTimeout(timeout);
  }
}