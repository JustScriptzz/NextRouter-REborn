import { destroySession } from '@/lib/auth';
import { jsonOk } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST() {
  await destroySession();
  return jsonOk({ ok: true });
}