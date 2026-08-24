import type { Metadata } from 'next';
import StatusBoard from './StatusBoard';

export const metadata: Metadata = {
  title: 'Live model status — NextRouter REborn',
  description: 'Real-time availability, latency and speed for every model on NextRouter.',
};

export const dynamic = 'force-dynamic';

export default function StatusPage() {
  return <StatusBoard />;
}
