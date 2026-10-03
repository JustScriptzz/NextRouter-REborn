// Public demo key ("demo") + system test key. Both work with zero config —
// no bot, no database. Limits are hardcoded here; usage lives in process
// memory, keyed per user (approximate on serverless: per-isolate, resets on
// restart/deploy). Good enough for trial buckets; real per-user tracking
// lives in the bot ledger.
import type { UsagePoint } from './types';

export const DEMO_KEY = 'demo';
export const DEMO_USER_ID = 'demo';
export const DEMO_CAP = 40_000_000;
export const DEMO_RPM = 30;

export const SYSTEM_USER_ID = 'system-test';

export interface DemoUser {
  id: string;
  email: string;
  username: string;
}

export const DEMO_IDENTITY: DemoUser = {
  id: DEMO_USER_ID,
  email: 'demo@local',
  username: 'demo',
};

export const SYSTEM_IDENTITY: DemoUser = {
  id: SYSTEM_USER_ID,
  email: 'system-test@local',
  username: 'system-test',
};

const ledger = new Map<string, UsagePoint>();

function dayKey(userId: string): string {
  return `${userId}:${new Date().toISOString().slice(0, 10)}`;
}

export function ledgerToday(userId: string): UsagePoint {
  return ledger.get(dayKey(userId)) ?? { tokens: 0, calls: 0 };
}

export function ledgerRecord(userId: string, tokens: number): void {
  const k = dayKey(userId);
  const cur = ledger.get(k) ?? { tokens: 0, calls: 0 };
  cur.tokens += Math.max(0, Math.round(tokens));
  cur.calls += 1;
  ledger.set(k, cur);
}

export function isLedgerUser(userId: string): boolean {
  return userId === DEMO_USER_ID || userId === SYSTEM_USER_ID;
}

// Back-compat wrappers for the demo bucket.
export function demoToday(): UsagePoint {
  return ledgerToday(DEMO_USER_ID);
}

export function demoRecord(tokens: number): void {
  ledgerRecord(DEMO_USER_ID, tokens);
}
