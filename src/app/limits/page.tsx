import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getEffectiveLimits } from '@/lib/user-limits';
import LimitsPage from './LimitsPage';

export const metadata: Metadata = {
  title: 'Limits',
};

export const dynamic = 'force-dynamic';

export default async function LimitsRoute() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <LimitsPage />;
}
