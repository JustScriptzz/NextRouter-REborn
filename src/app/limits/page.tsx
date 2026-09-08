import type { Metadata } from 'next';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: 'Limits',
};

export const dynamic = 'force-dynamic';

export default function LimitsRoute() {
  return <></>;
}