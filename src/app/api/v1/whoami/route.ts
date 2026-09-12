import { checkPublicRateLimit, resolveApiCaller, PUBLIC_RPM_PER_IP } from '@/lib/public-access';
import { jsonErrorCors, jsonOkCors } from '@/lib/http';

export const runtime = 'edge';

export async function GET(req: Request) {
  const caller = await resolveApiCaller(req);
  if (!caller) return jsonErrorCors(401, 'Invalid API key. Use the public key from the Docs page.');
  const limited = checkPublicRateLimit(caller);
  if (limited) return jsonErrorCors(429, limited, 'rate_limit');
  if (caller.kind === 'admin') {
    return jsonOkCors({
      mode: 'admin',
      rpm_per_ip: PUBLIC_RPM_PER_IP,
      limits: 'fixed — no increases',
    });
  }
  return jsonOkCors({
    mode: 'public',
    rpm_per_ip: PUBLIC_RPM_PER_IP,
    limits: 'fixed — no increases',
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
}
