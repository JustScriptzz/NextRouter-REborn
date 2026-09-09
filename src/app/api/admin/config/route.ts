import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getCatalog, getBuiltinProviderNames, getGatewaysHealth } from '@/lib/providers';
import { kvGetCached, isKvConfigured } from '@/lib/kv';
import { getModelStats } from '@/lib/model-stats';

export const runtime = 'edge';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [catalog, blockedModels, pinnedModels, disabledProviders, modelRules, extraGateways, stats] =
    await Promise.all([
      getCatalog({ includeBlocked: true }),
      kvGetCached('blocked_models'),
      kvGetCached('pinned_models'),
      kvGetCached('disabled_providers'),
      kvGetCached('model_rules'),
      kvGetCached('extra_gateways'),
      getModelStats(),
    ]);

  const blockedSet = new Set(blockedModels.map((b) => b.toLowerCase()));
  const statById = new Map(stats.map((s) => [s.id, s]));

  // A model is "manual" (admin-added, not from a built-in catalog scan) when
  // every provider entry backing it is the synthetic 'admin' provider used
  // by `add | ...` model_rules.
  const models = catalog.models.map((m) => {
    const providers = [...new Set((catalog.providersMap?.get(m.id) ?? []).map((p) => p.provider))];
    return {
      id: m.id,
      type: m.type,
      title: m.description,
      providers,
      hidden: blockedSet.has(m.id.toLowerCase()),
      manual: providers.length > 0 && providers.every((p) => p === 'admin'),
      avail: statById.get(m.id)?.avail ?? null,
    };
  });

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
