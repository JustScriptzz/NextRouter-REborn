import { kvGetCached } from '@/lib/config-store';
import { jsonOk } from '@/lib/http';

export const runtime = 'edge';

export async function GET() {
  const banner = await kvGetCached('banner');
  return jsonOk({ message: banner[0] ?? null });
}
