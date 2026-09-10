import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { setModelSystemPrompt } from '@/lib/model-system-prompt';

export const runtime = 'edge';

// Sets (or clears, with an empty prompt) the per-model system prompt.
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { id, prompt } = (body || {}) as { id?: unknown; prompt?: unknown };
  if (typeof id !== 'string' || !id.trim()) {
    return NextResponse.json({ error: 'Missing model id' }, { status: 400 });
  }
  if (typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const ok = await setModelSystemPrompt(id, prompt);
  if (!ok) {
    return NextResponse.json(
      { error: 'KV storage not configured for this deployment' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
