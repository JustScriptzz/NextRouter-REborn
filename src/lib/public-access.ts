import { rateLimiter } from './rateLimit';
import { resolveDiscordKey } from './discord-keys';

export const runtime = 'edge';

// Serverless access control: no database, no users table, no sessions.
// - Private per-Discord-user keys are minted by the Discord bot (/getkey,
//   /regenkey slash commands, see api/discord/interactions) and stored via
//   config-store (Vercel Blob). There is no shared/public key anymore.
// - The operator's own unlimited key is ADMIN_API_KEY (env-only, never
//   documented).
export const PUBLIC_RPM_PER_IP = 30; // per-key limit; name kept for API/doc compat

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

export type ApiCaller = { kind: 'admin' } | { kind: 'public'; discordUserId: string };

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
  const discordUserId = await resolveDiscordKey(key);
  if (discordUserId) return { kind: 'public', discordUserId };
  return null;
}

// Tracking id passed to upstream helpers. Usage persistence is a no-op
// serverless, so these are labels only.
export function trackingId(caller: ApiCaller): string {
  return caller.kind === 'admin' ? 'admin' : `discord:${caller.discordUserId}`;
}

// Fixed 30 RPM gate per private key. Returns an error message when
// limited, null when allowed. Admins bypass it.
export function checkPublicRateLimit(caller: ApiCaller): string | null {
  if (caller.kind === 'admin') return null;
  const ok = rateLimiter.allow(`rpm:${caller.discordUserId}`, PUBLIC_RPM_PER_IP);
  return ok
    ? null
    : `Rate limit of ${PUBLIC_RPM_PER_IP} requests/min exceeded. Try again shortly.`;
}
