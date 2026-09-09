import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getCatalog, getBuiltinProviderNames, getGatewaysHealth } from '@/lib/providers';
import { kvGetCached, isKvConfigured } from '@/lib/kv';

export const runtime = 'edge';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [catalog, blockedModels, pinnedModels, disabledProviders, modelRules, extraGateways] =
    await Promise.all([
      getCatalog({ includeBlocked: true }),
      kvGetCached('blocked_models'),
      kvGetCached('pinned_models'),
      kvGetCached('disabled_providers'),
      kvGetCached('model_rules'),
      kvGetCached('extra_gateways'),
    ]);

  const blockedSet = new Set(blockedModels.map((b) => b.toLowerCase()));

  const models = catalog.models.map((m) => ({
    id: m.id,
    type: m.type,
    title: m.description,
    providers: [...new Set((catalog.providersMap?.get(m.id) ?? []).map((p) => p.provider))],
    hidden: blockedSet.has(m.id.toLowerCase()),
  }));

  const health = getGatewaysHealth();
  const builtinProviders = getBuiltinProviderNames().map((name) => ({
    name,
    disabled: disabledProviders.includes(name),
    configured: health.find((h) => h.provider === name)?.configured ?? false,
  }));

  const customProviders = extraGateways
    .map((line) => {
      const [name, baseUrl] = line.split('|').map((p) => p.trim());
      return name ? { name, baseUrl: baseUrl || '' } : null;
    })
    .filter((p): p is { name: string; baseUrl: string } => p !== null);

  return NextResponse.json({
    kvConfigured: isKvConfigured(),
    models,
    pinnedModels,
    builtinProviders,
    customProviders,
    modelRulesCount: modelRules.length,
  });
}
