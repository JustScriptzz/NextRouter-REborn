import { desc, eq } from 'drizzle-orm';
import { generateApiKey, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { apiKeys } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';
import type { ApiKeyInfo } from '@/lib/types';

export const runtime = 'nodejs';

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
    
    const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
    const name =
      typeof body?.name === 'string' && body.name.trim()
        ? body.name.trim().slice(0, 64)
        : 'Default key';

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