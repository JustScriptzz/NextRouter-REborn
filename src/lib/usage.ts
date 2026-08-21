import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from './db/client';
import { dailyUsage } from './db/schema';
import type { UsagePoint, UsageSummary } from './types';

export const DAILY_TOKEN_LIMIT = 500_000;

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayUsage(userId: string): Promise<UsagePoint> {
  const date = todayUtc();
  const rows = await db
    .select()
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.date, date)))
    .limit(1);
  const row = rows[0];
  return { tokens: row?.tokens ?? 0, calls: row?.calls ?? 0 };
}

export async function getUsageRemaining(userId: string): Promise<number> {
  const { tokens } = await getTodayUsage(userId);
  return Math.max(0, DAILY_TOKEN_LIMIT - tokens);
}

export async function recordUsage(userId: string, tokens: number): Promise<void> {
  const date = todayUtc();
  const amount = Math.max(0, Math.round(tokens));
  await db
    .insert(dailyUsage)
    .values({ userId, date, tokens: amount, calls: 1 })
    .onConflictDoUpdate({
      target: [dailyUsage.userId, dailyUsage.date],
      set: {
        tokens: sql`${dailyUsage.tokens} + ${amount}`,
        calls: sql`${dailyUsage.calls} + 1`,
      },
    })
    .catch(() => undefined);
}

export async function getUserUsageSummary(userId: string): Promise<UsageSummary> {
  const today = await getTodayUsage(userId);
  const totals = await db
    .select({
      tokens: sql<number>`coalesce(sum(${dailyUsage.tokens}), 0)`,
      calls: sql<number>`coalesce(sum(${dailyUsage.calls}), 0)`,
    })
    .from(dailyUsage)
    .where(eq(dailyUsage.userId, userId));
  const last7 = await db
    .select()
    .from(dailyUsage)
    .where(eq(dailyUsage.userId, userId))
    .orderBy(desc(dailyUsage.date))
    .limit(7);
  return {
    today: { tokens: today.tokens, calls: today.calls },
    total: {
      tokens: Number(totals[0]?.tokens ?? 0),
      calls: Number(totals[0]?.calls ?? 0),
    },
    limit: DAILY_TOKEN_LIMIT,
    remaining: Math.max(0, DAILY_TOKEN_LIMIT - today.tokens),
    last7: [...last7].reverse().map((r) => ({
      date: r.date,
      tokens: r.tokens,
      calls: r.calls,
    })),
  };
}
const UNLIMITED_EMAILS = new Set([
  'ciullomarco13@gmail.com',
  'ciullo.marco13@gmail.com',
]);

export function isUnlimitedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return UNLIMITED_EMAILS.has(email.trim().toLowerCase());
}

export const UNLIMITED_BUDGET = Number.MAX_SAFE_INTEGER;
