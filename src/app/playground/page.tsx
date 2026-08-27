import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import PlaygroundClient from './PlaygroundClient';

export const metadata: Metadata = {
  title: 'Playground',
};

export const dynamic = 'force-dynamic';

export default async function PlaygroundPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <PlaygroundClient />;
}
