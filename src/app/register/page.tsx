import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { ClientRegisterForm } from './ClientRegisterForm';

export const metadata: Metadata = {
  title: 'Sign up',
};

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  try {
    const user = await getSessionUser();
    if (user) redirect('/models');
  } catch (error) {
    console.error('[RegisterPage] Error checking session:', error);
  }
  return <RegisterForm />;
}

function RegisterForm() {
  return (
    <div className="anim-fade-up mx-auto mt-10 w-full max-w-4xl sm:mt-16">
      <div className="card overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="relative hidden overflow-hidden p-10 md:block" style={{ borderRight: '0.5px solid #2d2d2d', background: '#0a0a0a' }}>
            <Link href="/" className="relative flex items-center gap-3">
              <img src="/logo.png" alt="NextRouter REborn" className="h-10 w-10 rounded-lg object-contain" style={{ border: '0.5px solid #2d2d2d' }} />
              <span className="text-lg font-bold text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
                NextRouter REborn
              </span>
            </Link>
            <div className="relative mt-24">
              <h2 className="text-2xl font-bold leading-snug text-white">
                Create your account
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Your username becomes your public model prefix – anything you publish is callable
                as{' '}
                <span className="font-mono text-white" style={{ background: '#1D1D1F', padding: '0 4px' }}>username/my-model</span>.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-zinc-400">
                <li className="flex items-center gap-2"><Tick /> Free API key in seconds</li>
                <li className="flex items-center gap-2"><Tick /> 500K tokens daily, no card required</li>
                <li className="flex items-center gap-2"><Tick /> Publish or keep models private</li>
              </ul>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <h1 className="text-xl font-semibold text-zinc-100">Sign up</h1>
            <p className="mb-7 mt-1 text-sm text-zinc-500">
              It takes less than a minute.
            </p>
            <ClientRegisterForm />
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