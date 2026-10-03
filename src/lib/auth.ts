// No accounts, no sessions: keys are the in-code demo key, the env-only
// system key, and nr_... rows in Postgres (plus an optional external
// validator via BOT_VALIDATOR_URL, inert unless configured).
// This module only answers "which identity does this Bearer key belong to"
// for the gateway routes.
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { apiKeys } from './db/schema';
import type { SessionUser } from './types';
import { isBannedEmail } from './admin';
import { botLedgerEnabled, validateKeyWithBot } from './bot-ledger';
import { DEMO_IDENTITY, DEMO_KEY, SYSTEM_IDENTITY, SYSTEM_USER_ID } from './demo';

function systemTestKey(): string {
  const v = (process.env.SYSTEM_TEST_KEY ?? '').trim();
  return v;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function getUserFromApiKey(
  authorization: string | null,
): Promise<SessionUser | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const key = authorization.slice(7).trim();
  // Public demo key. No bot, no database — enforced in-code (see demo.ts).
  if (key === DEMO_KEY) return { ...DEMO_IDENTITY };
  // System test key (env-only, never displayed). Unlimited rpm for full sweeps.
  const sys = systemTestKey();
  if (sys && key === sys) return { ...SYSTEM_IDENTITY, id: SYSTEM_USER_ID };
  if (!key.startsWith('nr_')) return null;
  // External validator mode: when BOT_VALIDATOR_URL is set, keys are checked
  // against it instead of Postgres.
  if (botLedgerEnabled()) {
    const botUser = await validateKeyWithBot(key);
    if (!botUser) return null;
    if (isBannedEmail(botUser.email)) return null;
    return botUser;
  }
  try {
    const row = await db.query.apiKeys
      .findFirst({
        where: eq(apiKeys.keyHash, hashApiKey(key)),
        with: { user: true },
      })
      .catch(() => null);
    if (!row || row.revokedAt) return null;
    const user = row.user;
    if (isBannedEmail(user.email)) return null;
    return { id: user.id, email: user.email, username: user.username };
  } catch {
    return null;
  }
}