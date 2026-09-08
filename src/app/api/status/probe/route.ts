import { jsonError, jsonOk } from '@/lib/http';
import { probeCatalog } from '@/lib/prober';

export const runtime = 'edge';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  const auth = req.headers.get('authorization') ?? '';
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  if (!isVercelCron && (!secret || auth !== `Bearer ${secret}`)) {
    return jsonError(401, 'Unauthorized');
  }
  const result = await probeCatalog();
  return jsonOk({ ok: true, probed: result.probed, at: Date.now() });
}
