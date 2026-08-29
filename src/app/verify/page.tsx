import type { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyClient from './VerifyClient';

export const metadata: Metadata = { title: 'Verify email' };
export const dynamic = 'force-dynamic';

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md flex-col items-center py-32">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
          <p className="mt-4 text-sm text-zinc-500">Verifying your email…</p>
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}