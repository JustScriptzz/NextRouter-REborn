import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { kvGetCached, kvSet } from '@/lib/kv';

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

  const { id, hidden } = (body || {}) as { id?: unknown; hidden?: unknown };
  if (typeof id !== 'string' || !id.trim() || typeof hidden !== 'boolean') {
    return NextResponse.json({ error: 'Missing id or hidden flag' }, { status: 400 });
  }

  const blocked = await kvGetCached('blocked_models');
  const lower = id.toLowerCase();
  const withoutId = blocked.filter((b) => b.toLowerCase() !== lower);
  const next = hidden ? [...withoutId, id] : withoutId;

  const ok = await kvSet('blocked_models', next);
  if (!ok) {
    return NextResponse.json(
      { error: 'KV storage not configured for this deployment' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
