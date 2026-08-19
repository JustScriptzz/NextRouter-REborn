import { getSessionUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { withV1Prefix } from '@/lib/upstream';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');

  const body = (await req.json().catch(() => null)) as {
    endpointUrl?: unknown;
    bearerToken?: unknown;
  } | null;
  if (!body || typeof body.endpointUrl !== 'string') {
    return jsonError(400, 'endpointUrl is required');
  }

  const endpointUrl = body.endpointUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(endpointUrl)) return jsonError(400, 'Endpoint URL must be http(s)');
  const url = `${withV1Prefix(endpointUrl)}/models`;
  const token = typeof body.bearerToken === 'string' ? body.bearerToken : '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    if (!upstream.ok) {
      return jsonError(502, 'The endpoint did not answer with the models list');
    }
    const data = (await upstream.json().catch(() => null)) as unknown;
    const ids = extractModelIds(data);
    if (ids.length === 0) {
      return jsonError(400, 'No models found at this endpoint');
    }
    return jsonOk({ models: ids });
  } catch {
    return jsonError(502, 'Could not reach the endpoint');
  } finally {
    clearTimeout(timeout);
  }
}

function extractModelIds(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null && 'id' in item) {
          const id = (item as { id?: unknown }).id;
          return typeof id === 'string' ? id : '';
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof data === 'object' && data !== null && 'data' in data) {
    return extractModelIds((data as { data?: unknown }).data);
  }
  return [];
}