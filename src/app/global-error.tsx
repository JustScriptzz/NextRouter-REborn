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
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-zinc-900/80 p-6">
            <h1 className="text-lg font-semibold text-red-300">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              A client-side exception occurred while the app was loading.
            </p>
            <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
              {error?.message ?? 'Unknown error'}
              {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
            </pre>
            <button
              type="button"
              onClick={reset}
              className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
