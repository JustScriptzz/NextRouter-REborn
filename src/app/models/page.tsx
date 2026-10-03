import { MODELS } from '@/lib/shell-config';
import ModelsExplorer from './ModelsExplorer';

export const metadata = { title: 'Models' };
export const dynamic = 'force-static';

export default function ModelsPage() {
  return (
    <div>
      <div className="micro">Models</div>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight text-white">Models</h1>
      <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-neutral-500">
        {MODELS.length === 0
          ? 'No providers chosen yet, so the catalog is empty. Tell me the providers and their model ids — they show up here, callable through /api/v1.'
          : <>Every id below is callable through <span className="mono text-neutral-300">/api/v1</span> — same id works for chat, Anthropic messages, and code.</>}
      </p>
      <div className="mt-5">
        <ModelsExplorer />
      </div>
      {MODELS.length > 0 && (
        <p className="mono mt-5 text-[11px] text-neutral-600">
          tip: click an id to copy it. paste into playground or curl.
        </p>
      )}
    </div>
  );
}
