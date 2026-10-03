'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="anim-fade-up mx-auto max-w-md py-24">
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10">
          <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6 text-red-400" aria-hidden>
            <path d="M10 6v5m0 3.5v.5M10 3l8 14H2L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-zinc-100">This page hit an error</h1>
        <p className="mt-1.5 text-sm text-zinc-500">It is not you, it is us. Try again.</p>
        <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/40 p-3 text-left font-mono text-xs text-zinc-400">
          {error?.message ?? 'Unknown error'}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>
        <button type="button" onClick={reset} className="btn-primary mt-5 w-full py-2.5">
          Try again
        </button>
      </div>
    </div>
  );
}
