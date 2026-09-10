import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isKvConfigured, kvGetCached, kvSet } from '@/lib/config-store';

export const runtime = 'edge';

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { provider, disabled } = (body || {}) as { provider?: unknown; disabled?: unknown };
  if (typeof provider !== 'string' || !provider.trim() || typeof disabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing provider or disabled flag' }, { status: 400 });
  }

  const list = await kvGetCached('disabled_providers');
  const lower = provider.toLowerCase();
  const withoutProvider = list.filter((p) => p.toLowerCase() !== lower);
  const next = disabled ? [...withoutProvider, provider] : withoutProvider;

  const ok = await kvSet('disabled_providers', next);
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
