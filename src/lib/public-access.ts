import { rateLimiter } from './rateLimit';

export const runtime = 'edge';

// Serverless access control: no database, no users table, no sessions.
// - A single shared public key (PUBLIC_API_KEY, env-only) gates every
//   /api/v1 endpoint at a fixed 30 RPM.
// - The operator's own unlimited key is ADMIN_API_KEY (env-only, never
//   documented).
// Per-Discord-user private keys (/getkey, /regenkey) are disabled for
// now - see git history (src/lib/discord-keys.ts) to bring them back.
export const PUBLIC_RPM_PER_IP = 30; // rpm limit for the public key

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY || '';

export type ApiCaller = { kind: 'admin' } | { kind: 'public' };

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
  if (safeEqual(key, PUBLIC_API_KEY)) return { kind: 'public' };
  return null;
}

// Tracking id passed to upstream helpers. Usage persistence is a no-op
// serverless, so these are labels only.
export function trackingId(caller: ApiCaller): string {
  return caller.kind === 'admin' ? 'admin' : 'public';
}

// Fixed 30 RPM gate on the shared public key. Returns an error message
// when limited, null when allowed. Admins bypass it.
export function checkPublicRateLimit(caller: ApiCaller): string | null {
  if (caller.kind === 'admin') return null;
  const ok = rateLimiter.allow('rpm:public', PUBLIC_RPM_PER_IP);
  return ok
    ? null
    : `Rate limit of ${PUBLIC_RPM_PER_IP} requests/min exceeded. Try again shortly.`;
}
