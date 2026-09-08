import { timingSafeEqual } from 'crypto';
import { rateLimiter } from './rateLimit';

// Serverless public access: no database, no users, no sessions.
// - Everyone uses the shared PUBLIC_API_KEY (documented on /docs).
// - The operator's own unlimited key is ADMIN_API_KEY (env-only, never
//   documented). Legacy per-user nr_ keys no longer exist.
export const PUBLIC_API_KEY =
  process.env.PUBLIC_API_KEY || 'nr_public_nextrouter_free';
export const PUBLIC_RPM_PER_IP = 30;

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

export type ApiCaller = { kind: 'admin' } | { kind: 'public'; ip: string };

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real && real.trim()) return real.trim();
  return 'unknown';
}

function bearerKey(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim();
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// null = missing/unknown credential.
export async function resolveApiCaller(req: Request): Promise<ApiCaller | null> {
  const key = bearerKey(req);
  if (!key) return null;
  if (safeEqual(key, ADMIN_API_KEY)) return { kind: 'admin' };
  if (safeEqual(key, PUBLIC_API_KEY)) return { kind: 'public', ip: getClientIp(req) };
  return null;
}

// Tracking id passed to upstream helpers. Usage persistence is a no-op
// serverless, so these are labels only.
export function trackingId(caller: ApiCaller): string {
  return caller.kind === 'admin' ? 'admin' : `public:${caller.ip}`;
}

// Fixed 30 RPM per IP gate for public callers. Returns an error message
// when limited, null when allowed. Admins bypass it.
export function checkPublicRateLimit(caller: ApiCaller): string | null {
  if (caller.kind === 'admin') return null;
  const ok = rateLimiter.allow(`public-rpm:${caller.ip}`, PUBLIC_RPM_PER_IP);
  return ok
    ? null
    : `Public rate limit of ${PUBLIC_RPM_PER_IP} requests/min per IP exceeded. Try again shortly.`;
}
