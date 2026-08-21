import type { Metadata } from 'next';
import { getCatalog, getFallbackModelId } from '@/lib/providers';
import type { CatalogModelDTO } from '@/components/ModelCard';
import ModelsExplorer from '@/components/ModelsExplorer';

export const metadata: Metadata = {
  title: 'Models',
};

export const dynamic = 'force-dynamic';

export default async function ModelsPage() {
  const catalog = await getCatalog();
  const fallbackId = await getFallbackModelId();
  const models: CatalogModelDTO[] = catalog.models.map((m) => ({
    id: m.id,
    title: m.description,
    type: m.type,
    isFallback: m.id === fallbackId,
  }));

  return (
    <div className="mx-auto max-w-5xl py-10">
      <div className="anim-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Models</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          Every model below is callable through{' '}
          <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-violet-300">
            /api/v1/chat/completions
          </code>{' '}
          or{' '}
          <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-cyan-300">
            /api/v1/images/generations
          </code>
          . Lists refresh live from each provider.
        </p>
      </div>
      <div className="anim-fade-up delay-1 mt-8">
        <ModelsExplorer models={models} />
      </div>
    </div>
  );
}
