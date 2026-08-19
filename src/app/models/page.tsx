import type { Metadata } from 'next';
import { getCatalog, getFallbackModelId } from '@/lib/providers';
import ModelCard from '@/components/ModelCard';

export const metadata: Metadata = {
  title: 'Models | NextRouter REborn',
};

export const dynamic = 'force-dynamic';

export default function ModelsPage() {
  const catalog = getCatalog();
  const fallbackId = getFallbackModelId();
  const models = catalog.models.map((m) => ({
    id: m.id,
    title: m.description,
    type: m.type,
    isFallback: m.id === fallbackId,
  }));
  return (
    <div className="mx-auto max-w-5xl py-10">
      <h1 className="text-2xl font-bold text-zinc-100">Models</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Use these model IDs with your API keys via <code className="text-zinc-300">/api/v1</code> endpoints.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((m) => (
          <ModelCard key={m.id} model={m} />
        ))}
      </div>
      {models.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
          No models available yet. Check the server environment variables.
        </div>
      )}
    </div>
  );
}