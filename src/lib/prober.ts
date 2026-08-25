import { getCatalog, type CatalogEntry } from './providers';
import { isProbeBackedOff, recordModelResult } from './model-stats';
import { proxiedFetch } from './proxy-pool';
import { withV1Prefix } from './upstream';

const PROBE_TIMEOUT_MS = 20000;
const IMAGE_PROBE_TIMEOUT_MS = 25000;
const CONCURRENCY = 8;
const MAX_PIPES_PER_MODEL = 2;

async function probePipe(
  id: string,
  type: string,
  baseUrl: string,
  apiKey: string,
  upstreamModel: string,
): Promise<boolean> {
  const base = withV1Prefix(baseUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const started = Date.now();
  try {
    let res: Response;
    if (type === 'image') {
      res = await proxiedFetch(`${base}/images/generations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: upstreamModel, prompt: 'ping', n: 1, size: '256x256' }),
        signal: AbortSignal.timeout(IMAGE_PROBE_TIMEOUT_MS),
        cache: 'no-store',
      });
    } else if (type === 'tts') {
      res = await proxiedFetch(`${base}/audio/speech`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: upstreamModel, input: 'ping', voice: 'default' }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        cache: 'no-store',
      });
    } else if (type === 'embedding') {
      res = await proxiedFetch(`${base}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: upstreamModel, input: 'ping' }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        cache: 'no-store',
      });
    } else {
      res = await proxiedFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: upstreamModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        cache: 'no-store',
      });
    }
    recordModelResult(id, res.ok, Date.now() - started, undefined, undefined, res.status);
    void res.text().catch(() => undefined);
    return res.ok;
  } catch {
    recordModelResult(id, false, Date.now() - started);
    return false;
  }
}

async function probeModel(id: string, type: string, pipes: CatalogEntry[]): Promise<void> {
  if (type === 'stt') return;
  for (const pipe of pipes.slice(0, MAX_PIPES_PER_MODEL)) {
    const ok = await probePipe(id, type, pipe.baseUrl, pipe.apiKey, pipe.upstreamModel);
    if (ok) return;
  }
}

export async function probeCatalog(): Promise<{ probed: number }> {
  const catalog = await getCatalog();
  const tasks: Array<() => Promise<void>> = [];
  for (const entry of catalog.models) {
    if (isProbeBackedOff(entry.id)) continue;
    const pipes =
      catalog.providersMap?.get(entry.id) && (catalog.providersMap.get(entry.id) ?? []).length > 0
        ? (catalog.providersMap.get(entry.id) as CatalogEntry[])
        : [entry];
    tasks.push(() => probeModel(entry.id, entry.type, pipes));
  }
  let idx = 0;
  let probed = 0;
  async function worker(): Promise<void> {
    while (idx < tasks.length) {
      const task = tasks[idx++];
      await task();
      probed += 1;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { probed };
}
