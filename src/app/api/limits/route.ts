import { getSessionUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import {
  getDecision,
  getEffectiveLimits,
} from '@/lib/user-limits';
import { getTodayUsage } from '@/lib/usage';
import { isUnlimitedEmail, UNLIMITED_BUDGET } from '@/lib/usage';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');

  const unlimited = isUnlimitedEmail(user.email);
  const limits = unlimited ? { rpm: -1, tokenLimit: UNLIMITED_BUDGET } : await getEffectiveLimits(user.id);
  const usage = await getTodayUsage(user.id);
  const decision = await getDecision(user.id);

  return jsonOk({
    limits,
    unlimited,
    usage: { tokens: usage.tokens, calls: usage.calls },
    remaining: Math.max(0, limits.tokenLimit - usage.tokens),
    decision: decision ?? null,
  });
}
