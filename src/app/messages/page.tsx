import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import MessagesClient from './MessagesClient';

export const metadata: Metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <MessagesClient />;
}
