// External-ledger client — gateway key validation + usage accounting through
// an external validator HTTP API, instead of Postgres.
//
// Active when BOT_VALIDATOR_URL and BOT_SHARED_SECRET are both set.
// When unset, the legacy Postgres paths in auth.ts / usage.ts apply.
//
// The bot is the sole owner of keys and the usage ledger: it mints keys,
// answers validation, records usage, and enforces nothing itself — the
// gateway 429s from the numbers the bot reports.

import type { UsagePoint, UsageSummary } from './types';

const BASE = (process.env.BOT_VALIDATOR_URL ?? '').replace(/\/+$/, '');
const SECRET = process.env.BOT_SHARED_SECRET ?? '';

export function botLedgerEnabled(): boolean {
  return BASE !== '' && SECRET !== '';
}

export function botDailyCap(): number {
  const n = Number(process.env.DAILY_CAP ?? 50000000);
  return Number.isFinite(n) && n > 0 ? n : 50000000;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SECRET}`,
        'User-Agent': 'NextRouter-gateway/1',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`bot ledger ${res.status} on ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface BotUser {
  id: string;
  email: string;
  username: string;
}

export async function validateKeyWithBot(key: string): Promise<BotUser | null> {
  try {
    const data = await call<{ valid?: boolean; user?: Partial<BotUser> }>(`/validate`, {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
    if (!data?.valid || !data.user?.id) return null;
    return {
      id: String(data.user.id),
      email: String(data.user.email ?? ''),
      username: String(data.user.username ?? ''),
    };
  } catch {
    return null;
  }
}

export interface BotLimits {
  cap: number;
  rpm: number;
}

export async function botUserLimits(userId: string): Promise<BotLimits> {
  try {
    const data = await call<{ cap?: number | null; rpm?: number | null }>(
      `/limits/${encodeURIComponent(userId)}`,
    );
    const cap = Number(data?.cap);
    const rpm = Number(data?.rpm);
    return {
      cap: Number.isFinite(cap) && cap > 0 ? cap : botDailyCap(),
      rpm: Number.isFinite(rpm) && rpm > 0 ? rpm : 0,
    };
  } catch {
    return { cap: botDailyCap(), rpm: 0 };
  }
}

export async function botTodayUsage(userId: string): Promise<UsagePoint> {
  const data = await call<{ tokens?: number; calls?: number }>(
    `/usage/${encodeURIComponent(userId)}`,
  );
  return {
    tokens: Math.max(0, Math.round(Number(data?.tokens ?? 0))),
    calls: Math.max(0, Math.round(Number(data?.calls ?? 0))),
  };
}

export async function botRecordUsage(userId: string, tokens: number): Promise<void> {
  try {
    await call(`/log`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, tokens: Math.max(0, Math.round(tokens)) }),
    });
  } catch {
    // Usage logging must never break a request.
  }
}

export async function botUsageSummary(userId: string): Promise<UsageSummary> {
  const cap = botDailyCap();
  const data = await call<{
    today?: UsagePoint;
    total?: UsagePoint;
    last7?: Array<{ date: string; tokens: number; calls: number }>;
  }>(`/summary/${encodeURIComponent(userId)}`);
  const today = {
    tokens: Math.max(0, Math.round(Number(data?.today?.tokens ?? 0))),
    calls: Math.max(0, Math.round(Number(data?.today?.calls ?? 0))),
  };
  return {
    today,
    total: {
      tokens: Math.max(0, Math.round(Number(data?.total?.tokens ?? 0))),
      calls: Math.max(0, Math.round(Number(data?.total?.calls ?? 0))),
    },
    limit: cap,
    remaining: Math.max(0, cap - today.tokens),
    last7: Array.isArray(data?.last7) ? data.last7 : [],
  };
}
