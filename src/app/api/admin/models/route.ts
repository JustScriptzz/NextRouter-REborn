import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isKvConfigured, kvGetCached, kvSet } from '@/lib/kv';
import type { ModelKind } from '@/lib/types';

export const runtime = 'edge';

const ALL_KINDS: ModelKind[] = ['text', 'image', 'tts', 'stt', 'video', 'embedding'];

// Strips pipe characters so a field can never break the `|`-delimited rule
// format the catalog parser (src/lib/providers.ts) expects.
function clean(v: string): string {
  return v.replace(/\|/g, '').trim();
}

// Upserts a `rename|name|type` rule for a given model id: any existing
// rule of the same kind for the same (current) id is replaced.
// Also supports:
//   action: 'add'    -> registers a brand-new model (any provider/endpoint,
//                        including ones not built into the site) as an
//                        `add | id | type | baseUrl | upstreamModel | description | apiKey` rule.
//   action: 'remove' -> deletes a manually-added model and any rules that
//                        reference it (add/rename/name/type/endpoint).
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    id,
    action,
    value,
    type,
    baseUrl,
    upstreamModel,
    apiKey,
    description,
  } = (body || {}) as {
    id?: unknown;
    action?: unknown;
    value?: unknown;
    type?: unknown;
    baseUrl?: unknown;
    upstreamModel?: unknown;
    apiKey?: unknown;
    description?: unknown;
  };

  if (typeof id !== 'string' || !id.trim()) {
    return NextResponse.json({ error: 'Missing model id' }, { status: 400 });
  }
  if (action !== 'rename' && action !== 'name' && action !== 'type' && action !== 'add' && action !== 'remove') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const cleanId = clean(id);
  const rules = await kvGetCached('model_rules');

  if (action === 'remove') {
    const filtered = rules.filter((rule) => {
      const parts = rule.split('|').map((p) => p.trim());
      return parts[1] !== cleanId && parts[2] !== cleanId;
    });
    const ok = await kvSet('model_rules', filtered);
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

  if (action === 'add') {
    if (typeof type !== 'string' || !ALL_KINDS.includes(type as ModelKind)) {
      return NextResponse.json({ error: 'Invalid or missing model type' }, { status: 400 });
    }
    if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
      return NextResponse.json({ error: 'Missing base URL' }, { status: 400 });
    }
    const cleanUpstream = typeof upstreamModel === 'string' && upstreamModel.trim() ? clean(upstreamModel) : cleanId;
    const cleanDescription = typeof description === 'string' ? clean(description) || cleanId : cleanId;
    const cleanApiKey = typeof apiKey === 'string' ? clean(apiKey) : '';
    const cleanBaseUrl = clean(baseUrl);

    // Replace any existing 'add' rule for this id so re-adding edits in place.
    const filtered = rules.filter((rule) => {
      const parts = rule.split('|').map((p) => p.trim());
      return !(parts[0]?.toLowerCase() === 'add' && parts[1] === cleanId);
    });
    filtered.push(
      `add | ${cleanId} | ${type} | ${cleanBaseUrl} | ${cleanUpstream} | ${cleanDescription} | ${cleanApiKey}`,
    );
    const ok = await kvSet('model_rules', filtered);
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

  // rename | name | type (existing-model edits)
  if (typeof value !== 'string' || !value.trim()) {
    return NextResponse.json({ error: 'Missing value' }, { status: 400 });
  }
  if (action === 'type' && !ALL_KINDS.includes(value as ModelKind)) {
    return NextResponse.json({ error: 'Invalid model type' }, { status: 400 });
  }

  const filtered = rules.filter((rule) => {
    const parts = rule.split('|').map((p) => p.trim());
    return !(parts[0]?.toLowerCase() === action && parts[1] === cleanId);
  });

  const newId = action === 'rename' ? clean(value) : cleanId;
  const newValue = action === 'rename' ? newId : clean(value);
  filtered.push(`${action} | ${cleanId} | ${newValue}`);

  const ok = await kvSet('model_rules', filtered);
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
