import { dailyLimiter, rateLimiter } from './rateLimit';

export const runtime = 'edge';

// Serverless access control: no database, no users table, no sessions.
// - A single shared public key (PUBLIC_API_KEY, env-only) gates every
//   /api/v1 endpoint: 20 requests/min + 500 requests/day, both per IP.
// - The operator's own unlimited key is ADMIN_API_KEY (env-only, never
//   documented).
export const PUBLIC_RPM_PER_IP = 20; // requests/min per IP
export const PUBLIC_DAILY_PER_IP = 500; // requests/day per IP (UTC-day buckets)

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
export const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY || '';

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

// Constant-time string comparison without Node's `crypto` module, so this
// stays compatible with the Edge Runtime (Cloudflare Pages / next-on-pages).
function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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
  return caller.kind === 'admin' ? 'admin' : 'public';
}

// Fixed 20 RPM + 500/day gates per IP on the shared public key. Returns
// an error message when limited, null when allowed. Admins bypass both.
export function checkPublicRateLimit(caller: ApiCaller): string | null {
  if (caller.kind === 'admin') return null;
  if (!rateLimiter.allow(`rpm:${caller.ip}`, PUBLIC_RPM_PER_IP)) {
    return `Rate limit of ${PUBLIC_RPM_PER_IP} requests/min per IP exceeded. Try again shortly.`;
  }
  if (!dailyLimiter.allow(`daily:${caller.ip}`, PUBLIC_DAILY_PER_IP)) {
    return `Daily limit of ${PUBLIC_DAILY_PER_IP} requests/day per IP exceeded. Try again tomorrow.`;
  }
  return null;
}
