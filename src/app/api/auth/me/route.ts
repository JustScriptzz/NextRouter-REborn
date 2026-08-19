import { getSessionUser } from '@/lib/auth';
import { jsonOk } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  return jsonOk({ user });
}