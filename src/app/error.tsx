'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-20">
      <h1 className="text-lg font-semibold text-red-300">
        This page hit an error
      </h1>
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
        {error?.message ?? 'Unknown error'}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
      >
        Try again
      </button>
    </div>
  );
}
