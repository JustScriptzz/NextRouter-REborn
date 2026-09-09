// Lightweight, DB-free admin session tokens.
// Signed with SESSION_SECRET using the Web Crypto API so this stays
// compatible with the Edge Runtime (Cloudflare Pages / next-on-pages).

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function toBase64Url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Constant-time string comparison (no Node `crypto`, Edge Runtime safe).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function getKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me';
}

export async function createAdminToken(email: string): Promise<string> {
  const payload = JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = toBase64Url(encoder.encode(payload));
  const key = await getKey(getSecret());
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sig));
  return `${payloadB64}.${sigB64}`;
}

export async function verifyAdminToken(
  token: string | undefined | null
): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return null;

    const key = await getKey(getSecret());
    const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
    const expectedSigB64 = toBase64Url(new Uint8Array(expectedSig));
    if (!safeEqual(expectedSigB64, sigB64)) return null;

    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64)));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export function checkAdminCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL || 'ciullomarco13@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'NexRouter_313';
  return (
    safeEqual(email.trim().toLowerCase(), adminEmail.toLowerCase()) &&
    safeEqual(password, adminPassword)
  );
}

export const ADMIN_SESSION_COOKIE = 'admin_session';

// Server-side guard for Route Handlers: reads the signed cookie via
// `next/headers` and verifies it. Returns the session or null.
export async function requireAdmin(): Promise<{ email: string } | null> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminToken(token);
}
