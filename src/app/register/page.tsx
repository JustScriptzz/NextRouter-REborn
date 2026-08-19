import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { ClientRegisterForm } from './ClientRegisterForm';

export const metadata: Metadata = {
  title: 'Sign up | NextRouter REborn',
};

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect('/models');
  return <RegisterForm />;
}

function RegisterForm() {
  return (
    <div className="mx-auto mt-16 w-full max-w-md">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-xl">
        <div className="mb-6 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-2xl font-bold text-transparent">
          NextRouter REborn
        </div>
        <h1 className="mb-1 text-lg font-semibold text-zinc-100">Create your account</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Your username becomes the model prefix, e.g.{' '}
          <span className="text-zinc-300">username/my-model</span>.
        </p>
        <ClientRegisterForm />
      </div>
    </div>
  );
}