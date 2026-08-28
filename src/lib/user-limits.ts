import { kvGetCached, kvSet, kvInvalidateCache } from './kv';

const DEFAULT_RPM = 15;
const DEFAULT_TOKEN_LIMIT = 500_000;

export interface UserLimits {
  rpm: number;
  tokenLimit: number;
}

export interface LimitRequest {
  id: string;
  userId: string;
  username: string;
  email: string;
  requestedRpm: number | null; // null = infinity
  requestedTokens: number | null; // null = infinity
  why: string;
  models: string;
  createdAt: number;
  status: 'pending' | 'thinking' | 'accepted' | 'rejected';
  decidedRpm?: number | null;
  decidedTokens?: number | null;
  decidedAt?: number;
  decidedNote?: string;
}

export interface PendingDecision {
  decided: 'accepted' | 'rejected' | 'thinking';
  at: number;
  grantedRpm?: number | null;
  grantedTokens?: number | null;
  note?: string;
}

interface KVPayload<T> {
  v: T;
  ts: number;
}

async function readKV<T>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await kvGetCached(key);
    if (rows && rows[0]) {
      const parsed = JSON.parse(rows[0]) as KVPayload<T>;
      if (parsed && 'v' in parsed) return parsed.v;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function encodeKV<T>(data: T): string[] {
  const payload: KVPayload<T> = { v: data, ts: Date.now() };
  return [JSON.stringify(payload)];
}

const USER_LIMITS_KEY = 'user_limits_map';
const REQUESTS_KEY = 'limit_requests_list';
const DECISIONS_KEY = 'limit_decisions_map';

// Per-user limits (custom overrides). Absent user => defaults.
export async function getEffectiveLimits(userId: string): Promise<UserLimits> {
  const map = await readKV<Record<string, UserLimits>>(USER_LIMITS_KEY, {});
  const l = map[userId];
  return {
    rpm: l?.rpm || DEFAULT_RPM,
    tokenLimit: l?.tokenLimit || DEFAULT_TOKEN_LIMIT,
  };
}

export function getDefaultLimits(): UserLimits {
  return { rpm: DEFAULT_RPM, tokenLimit: DEFAULT_TOKEN_LIMIT };
}

export async function setUserLimits(userId: string, limits: Partial<UserLimits>): Promise<UserLimits> {
  const map = await readKV<Record<string, UserLimits>>(USER_LIMITS_KEY, {});
  const current = map[userId] || { rpm: DEFAULT_RPM, tokenLimit: DEFAULT_TOKEN_LIMIT };
  const next: UserLimits = {
    rpm: limits.rpm !== undefined ? limits.rpm : current.rpm,
    tokenLimit: limits.tokenLimit !== undefined ? limits.tokenLimit : current.tokenLimit,
  };
  map[userId] = next;
  await kvSet(USER_LIMITS_KEY, encodeKV(map));
  kvInvalidateCache();
  return next;
}

// Pending requests
export async function listPendingRequests(): Promise<LimitRequest[]> {
  const list = await readKV<LimitRequest[]>(REQUESTS_KEY, []);
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

export async function createLimitRequest(req: Omit<LimitRequest, 'createdAt' | 'status'>): Promise<LimitRequest> {
  const list = await readKV<LimitRequest[]>(REQUESTS_KEY, []);
  const full: LimitRequest = { ...req, createdAt: Date.now(), status: 'pending' };
  list.push(full);
  await kvSet(REQUESTS_KEY, encodeKV(list));
  kvInvalidateCache();
  return full;
}

export async function findRequest(id: string): Promise<LimitRequest | null> {
  const list = await listPendingRequests();
  return list.find((r) => r.id === id) ?? null;
}

export function updateRequest(
  id: string,
  patch: Partial<LimitRequest>,
): Promise<LimitRequest | null> {
  return updateRequestInList(id, patch);
}

async function updateRequestInList(
  id: string,
  patch: Partial<LimitRequest>,
): Promise<LimitRequest | null> {
  const list = await readKV<LimitRequest[]>(REQUESTS_KEY, []);
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, decidedAt: Date.now() };
  await kvSet(REQUESTS_KEY, encodeKV(list));
  kvInvalidateCache();
  return list[idx];
}

// Decisions surfaced to users (banner)
export async function getDecision(userId: string): Promise<PendingDecision | null> {
  const map = await readKV<Record<string, PendingDecision>>(DECISIONS_KEY, {});
  const d = map[userId];
  return d ?? null;
}

export async function setDecision(userId: string, decision: PendingDecision): Promise<void> {
  const map = await readKV<Record<string, PendingDecision>>(DECISIONS_KEY, {});
  map[userId] = decision;
  await kvSet(DECISIONS_KEY, encodeKV(map));
  kvInvalidateCache();
}

export async function clearDecision(userId: string): Promise<void> {
  const map = await readKV<Record<string, PendingDecision>>(DECISIONS_KEY, {});
  delete map[userId];
  await kvSet(DECISIONS_KEY, encodeKV(map));
  kvInvalidateCache();
}
