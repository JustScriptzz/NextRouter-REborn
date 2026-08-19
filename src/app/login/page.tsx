import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { ClientLoginForm } from './ClientLoginForm';

export const metadata: Metadata = {
  title: 'Log in | NextRouter REborn',
};

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/models');
  return <LoginForm />;
}

function LoginForm() {
  return (
    <div className="mx-auto mt-16 w-full max-w-md">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-xl">
        <div className="mb-6 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-2xl font-bold text-transparent">
          NextRouter REborn
        </div>
        <h1 className="mb-1 text-lg font-semibold text-zinc-100">Welcome back</h1>
        <p className="mb-6 text-sm text-zinc-500">Log in to access your models and keys.</p>
        <ClientLoginForm />
      </div>
    </div>
  );
}