'use client';

import { useEffect } from 'react';
import { getCatalog } from '@/lib/providers';
import { jsonOkCors } from '@/lib/http';
import SiteChrome from '@/components/SiteChrome';

export default function Home() {
  useEffect(() => {
    // Intro: prefetch live models to warm the cache.
    // We keep this out of the model list component so it only runs once
    // on initial page load.
    (async () => {
      try {
        await getCatalog();
      } catch {}
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteChrome>
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-zinc-100">
              NextRouter REborn
            </h1>
            <p className="text-zinc-500 mb-12">
              A shared‑key, serverless AI gateway. Visit <a href="/docs">/docs</a> for setup.
            </p>
          </div>
        </main>
      </SiteChrome>
    </div>
  );
}