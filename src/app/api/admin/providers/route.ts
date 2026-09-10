import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isKvConfigured, kvGetCached, kvSet } from '@/lib/config-store';

export const runtime = 'edge';

// Adds a custom OpenAI-compatible gateway: `name|baseUrl|apiKey`.
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name, baseUrl, apiKey } = (body || {}) as {
    name?: unknown;
    baseUrl?: unknown;
    apiKey?: unknown;
  };

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Missing provider name' }, { status: 400 });
  }
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
    return NextResponse.json({ error: 'Missing base URL' }, { status: 400 });
  }

  const cleanName = name.trim();
  const cleanBase = baseUrl.trim();

  try {
    const parsed = new URL(cleanBase);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad protocol');
  } catch {
    return NextResponse.json(
      { error: 'Base URL must be a valid http(s) URL, e.g. https://api.example.com' },
      { status: 400 },
    );
  }
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';

  const gateways = await kvGetCached('extra_gateways');
  const withoutSameName = gateways.filter((line) => {
    const existingName = line.split('|')[0]?.trim().toLowerCase();
    return existingName !== cleanName.toLowerCase();
  });
  withoutSameName.push(`${cleanName} | ${cleanBase} | ${cleanKey}`);

  const ok = await kvSet('extra_gateways', withoutSameName);
  if (!ok) {
    return isKvConfigured()
      ? NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 })
      : NextResponse.json(
          { error: 'KV storage not configured for this deployment' },
          { status: 503 },
        );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name } = (body || {}) as { name?: unknown };
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Missing provider name' }, { status: 400 });
  }

  const gateways = await kvGetCached('extra_gateways');
  const lower = name.trim().toLowerCase();
  const filtered = gateways.filter((line) => line.split('|')[0]?.trim().toLowerCase() !== lower);

  const ok = await kvSet('extra_gateways', filtered);
  if (!ok) {
    return isKvConfigured()
      ? NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 })
      : NextResponse.json(
          { error: 'KV storage not configured for this deployment' },
          { status: 503 },
        );
  }

  return NextResponse.json({ ok: true });
}
