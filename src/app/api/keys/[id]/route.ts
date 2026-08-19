import { eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { apiKeys } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  const { id } = await params;

  const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  const existing = rows[0];
  if (!existing || existing.userId !== user.id) return jsonError(404, 'Key not found');

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, id));
  return jsonOk({ ok: true });
}