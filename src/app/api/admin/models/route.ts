import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { kvGetCached, kvSet } from '@/lib/kv';
import type { ModelKind } from '@/lib/types';

export const runtime = 'edge';

const ALL_KINDS: ModelKind[] = ['text', 'image', 'tts', 'stt', 'video', 'embedding'];

// Upserts a `rename|name|type` rule for a given model id: any existing
// rule of the same kind for the same (current) id is replaced.
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { id, action, value } = (body || {}) as {
    id?: unknown;
    action?: unknown;
    value?: unknown;
  };

  if (typeof id !== 'string' || !id.trim()) {
    return NextResponse.json({ error: 'Missing model id' }, { status: 400 });
  }
  if (action !== 'rename' && action !== 'name' && action !== 'type') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  if (typeof value !== 'string' || !value.trim()) {
    return NextResponse.json({ error: 'Missing value' }, { status: 400 });
  }
  if (action === 'type' && !ALL_KINDS.includes(value as ModelKind)) {
    return NextResponse.json({ error: 'Invalid model type' }, { status: 400 });
  }

  const rules = await kvGetCached('model_rules');
  const filtered = rules.filter((rule) => {
    const parts = rule.split('|').map((p) => p.trim());
    return !(parts[0]?.toLowerCase() === action && parts[1] === id);
  });

  const newId = action === 'rename' ? value.trim() : id;
  const newValue = action === 'rename' ? newId : value.trim();
  filtered.push(`${action} | ${id} | ${newValue}`);

  const ok = await kvSet('model_rules', filtered);
  if (!ok) {
    return NextResponse.json(
      { error: 'KV storage not configured for this deployment' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
