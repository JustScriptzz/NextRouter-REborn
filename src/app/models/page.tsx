import type { Metadata } from 'next';
import { getCatalog, getFallbackModelId } from '@/lib/providers';
import { MODEL_KIND_LABELS, type ModelKind } from '@/lib/types';
import ModelCard from '@/components/ModelCard';

export const metadata: Metadata = {
  title: 'Models | NextRouter REborn',
};

export const dynamic = 'force-dynamic';

const SECTION_ORDER: ModelKind[] = ['text', 'image'];

export default async function ModelsPage() {
  const catalog = await getCatalog();
  const fallbackId = await getFallbackModelId();
  const models = catalog.models.map((m) => ({
    id: m.id,
    title: m.description,
    type: m.type,
    isFallback: m.id === fallbackId,
  }));

  const byType = new Map<ModelKind, typeof models>();
  for (const model of models) {
    const list = byType.get(model.type) ?? [];
    list.push(model);
    byType.set(model.type, list);
  }

  return (
    <div className="mx-auto max-w-5xl py-10">
      <h1 className="text-2xl font-bold text-zinc-100">Models</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Use these model IDs with your API keys via{' '}
        <code className="text-zinc-300">/api/v1</code> endpoints. Lists are refreshed live
        from each provider.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 text-xs text-zinc-500">
        {SECTION_ORDER.map((kind) => {
          const items = byType.get(kind) ?? [];
          if (items.length === 0) return null;
          return (
            <span key={kind} className="rounded-full border border-zinc-800 px-3 py-1">
              {MODEL_KIND_LABELS[kind]}: {items.length}
            </span>
          );
        })}
      </div>
      {SECTION_ORDER.map((kind) => {
        const items = byType.get(kind) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={kind} className="mt-10">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">
              {MODEL_KIND_LABELS[kind]}{' '}
              <span className="text-sm text-zinc-500">({items.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m) => (
                <ModelCard key={m.id} model={m} />
              ))}
            </div>
          </section>
        );
      })}
      {models.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
          No models available yet. Check the server environment variables.
        </div>
      )}
    </div>
  );
}
