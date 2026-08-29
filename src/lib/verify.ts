import { createHash, randomBytes } from 'crypto';
import { kvGet, kvSet, kvInvalidateCache } from './kv';

// KV-backed email verification state. Uses the app_config table already present.
// No DB schema migration required.

const PENDINGS_KEY = 'verify_pendings'; // token -> pending account
const VERIFIED_KEY = 'verified_emails'; // list of verified emails
const TOKENS_KEY = 'verify_tokens'; // email -> token (for resend)
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface Pending {
  token: string;
  email: string;
  username: string;
  passwordHash: string;
  expiry: number;
}

type StringMap = Record<string, string>;

async function readMap<T>(key: string): Promise<T> {
  try {
    const rows = await kvGet(key);
    if (rows && rows[0]) {
      const parsed = JSON.parse(rows[0]) as { v: T; ts: number };
      if (parsed && 'v' in parsed && parsed.v !== null && typeof parsed.v === 'object') return parsed.v;
    }
  } catch {
    /* ignore */
  }
  return {} as T;
}

async function writeMap(key: string, map: unknown): Promise<void> {
  await kvSet(key, [JSON.stringify({ v: map, ts: Date.now() })]);
  kvInvalidateCache();
}

export function generateVerificationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function tokenDigest(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function createPendingVerification(
  email: string,
  username: string,
  passwordHash: string,
): Promise<{ token: string; pending: Pending }> {
  const token = generateVerificationToken();
  const pending: Pending = {
    token: tokenDigest(token),
    email,
    username,
    passwordHash,
    expiry: Date.now() + TOKEN_TTL_MS,
  };
  const pendings = await readMap<Record<string, Pending>>(PENDINGS_KEY);
  pendings[email] = pending;
  await writeMap(PENDINGS_KEY, pendings);

  const tokens = await readMap<StringMap>(TOKENS_KEY);
  tokens[email] = token;
  await writeMap(TOKENS_KEY, tokens);
  return { token, pending };
}

export async function getVerifiedEmails(): Promise<Set<string>> {
  const list = await readMap<Record<string, boolean>>(VERIFIED_KEY);
  return new Set(Object.keys(list).filter((e) => list[e]));
}

export async function isEmailVerified(emailRaw: string): Promise<boolean> {
  const email = emailRaw.trim().toLowerCase();
  const verified = await getVerifiedEmails();
  return verified.has(email);
}

export async function getPending(emailRaw: string): Promise<Pending | null> {
  const email = emailRaw.trim().toLowerCase();
  const pendings = await readMap<Record<string, Pending>>(PENDINGS_KEY);
  const p = pendings[email];
  if (!p) return null;
  if (p.expiry < Date.now()) {
    // expired — clean it up
    await deletePending(email);
    return null;
  }
  return p;
}

export async function deletePending(email: string): Promise<void> {
  const pendings = await readMap<Record<string, Pending>>(PENDINGS_KEY);
  delete pendings[email];
  await writeMap(PENDINGS_KEY, pendings);
  const tokens = await readMap<StringMap>(TOKENS_KEY);
  delete tokens[email];
  await writeMap(TOKENS_KEY, tokens);
}

export async function getTokenFor(emailRaw: string): Promise<string | null> {
  const email = emailRaw.trim().toLowerCase();
  const tokens = await readMap<StringMap>(TOKENS_KEY);
  return tokens[email] ?? null;
}

export async function completeVerification(tokenRaw: string): Promise<Pending | null> {
  const digest = tokenDigest(tokenRaw);
  const pendings = await readMap<Record<string, Pending>>(PENDINGS_KEY);
  for (const [email, p] of Object.entries(pendings)) {
    if (p.token === digest && p.expiry >= Date.now()) {
      // mark verified
      const verified = await readMap<Record<string, boolean>>(VERIFIED_KEY);
      verified[email] = true;
      await writeMap(VERIFIED_KEY, verified);
      await deletePending(email);
      return p;
    }
  }
  return null;
}
