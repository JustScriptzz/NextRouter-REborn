'use client';

import { useEffect } from 'react';

export default function ModelsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[/models] Render error:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-5xl py-10">
      <h1 className="text-2xl font-bold text-zinc-50">Models temporarily unavailable</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
        We hit a problem loading the model catalog. This does not affect the API itself.
      </p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded px-3 py-1.5 text-sm text-zinc-100"
        style={{ background: '#1D1D1F' }}
      >
        Try again
      </button>
    </div>
  );
}
