import { desc, eq } from 'drizzle-orm';
import { generateApiKey, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { apiKeys } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';
import type { ApiKeyInfo } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_KEYS_PER_ACCOUNT = 5;

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Not signed in');

    const rows = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .orderBy(desc(apiKeys.createdAt));

    const keys: ApiKeyInfo[] = rows
      .filter((row) => !row.revokedAt)
      .map((row) => ({
        id: row.id,
        name: row.name,
        masked: row.masked,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
      }));
    return jsonOk({ keys });
  } catch (error) {
    console.error('[GET /api/keys] Error:', error);
    return jsonError(500, 'Failed to fetch keys');
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Not signed in');

    const existing = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id));

    const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
    const name =
      typeof body?.name === 'string' && body.name.trim()
        ? body.name.trim().slice(0, 64)
        : 'Default key';

    const activeCount = existing.filter((row) => !row.revokedAt).length;
    if (activeCount >= MAX_KEYS_PER_ACCOUNT) {
      // Playground keys are ephemeral auto-minted sessions: rotate the oldest
      // one instead of locking the user out of the Playground. Real keys are
      // never touched — at-cap users without a Playground key still get 429.
      if (name === 'Playground') {
        const oldestPlayground = existing
          .filter((row) => !row.revokedAt && row.name === 'Playground')
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        if (!oldestPlayground) {
          return jsonError(
            429,
            `You've reached the limit of ${MAX_KEYS_PER_ACCOUNT} API keys per account. Revoke an existing key before creating a new one.`,
          );
        }
        await db
          .update(apiKeys)
          .set({ revokedAt: new Date() })
          .where(eq(apiKeys.id, oldestPlayground.id));
      } else {
        return jsonError(
          429,
          `You've reached the limit of ${MAX_KEYS_PER_ACCOUNT} API keys per account. Revoke an existing key before creating a new one.`,
        );
      }
    }
    const generated = generateApiKey();
    await db.insert(apiKeys).values({
      userId: user.id,
      name,
      keyHash: generated.hash,
      masked: generated.masked,
    });
    return jsonOk({ key: generated.key, masked: generated.masked, name });
  } catch (error) {
    console.error('[POST /api/keys] Error:', error);
    return jsonError(500, 'Failed to create key');
  }
}
