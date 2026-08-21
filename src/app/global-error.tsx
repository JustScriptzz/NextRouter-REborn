'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10">
              <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6 text-red-400" aria-hidden>
                <path d="M10 6v5m0 3.5v.5M10 3l8 14H2L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="mt-4 text-center text-lg font-semibold text-zinc-100">
              Something went wrong
            </h1>
            <p className="mt-1.5 text-center text-sm text-zinc-500">
              A client-side exception occurred while the app was loading.
            </p>
            <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-400">
              {error?.message ?? 'Unknown error'}
              {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
            </pre>
            <button
              type="button"
              onClick={reset}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-violet-400"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
