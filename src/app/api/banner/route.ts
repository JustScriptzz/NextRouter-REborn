import { kvGetCached } from '@/lib/kv';
import { jsonOk } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET() {
  const banner = await kvGetCached('banner');
  return jsonOk({ message: banner[0] ?? null });
}
