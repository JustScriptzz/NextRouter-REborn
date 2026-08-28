import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { ClientLoginForm } from './ClientLoginForm';

export const metadata: Metadata = {
  title: 'Log in',
};

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/models');
  return <LoginForm />;
}

function LoginForm() {
  return (
    <div className="anim-fade-up mx-auto mt-10 w-full max-w-4xl sm:mt-16">
      <div className="card overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="relative hidden overflow-hidden p-10 md:block" style={{ borderRight: '0.5px solid #2d2d2d', background: '#0a0a0a' }}>
            <Link href="/" className="relative flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg font-mono text-sm font-bold" style={{ background: '#ffffff', color: '#000000', border: '0.5px solid #2d2d2d' }}>
                NR
              </span>
              <span className="text-lg font-bold text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
                NextRouter REborn
              </span>
            </Link>
            <div className="relative mt-24">
              <h2 className="text-2xl font-bold leading-snug text-white">
                One key.
                <br />
                Every model.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Text and image models behind a single OpenAI-compatible gateway with automatic
                retries and failover.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-zinc-400">
                <li className="flex items-center gap-2"><Tick /> 500K free tokens daily</li>
                <li className="flex items-center gap-2"><Tick /> Bring your own endpoints</li>
                <li className="flex items-center gap-2"><Tick /> Per-key usage tracking</li>
              </ul>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <h1 className="text-xl font-semibold text-zinc-100">Welcome back</h1>
            <p className="mb-7 mt-1 text-sm text-zinc-500">
              Log in to access your models and keys.
            </p>
            <ClientLoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-white" aria-hidden>
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}