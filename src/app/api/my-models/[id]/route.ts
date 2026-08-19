import { and, eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { toDTO } from '@/lib/customModels';
import { db } from '@/lib/db/client';
import { customModels } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';
import { getCatalogModel } from '@/lib/providers';
import { validateCustomModelPayload } from '@/lib/validation';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  const { id } = await params;

  const rows = await db
    .select()
    .from(customModels)
    .where(and(eq(customModels.modelId, id), eq(customModels.userId, user.id)))
    .limit(1);
  const existing = rows[0];
  if (!existing) return jsonError(404, 'Model not found');

  const raw = await req.json().catch(() => null);
  const validated = validateCustomModelPayload(raw);
  if (!validated.ok) return jsonError(400, validated.message);
  const payload = validated.payload;

  const fallback = getCatalogModel(payload.fallbackModelId);
  if (!fallback) return jsonError(400, 'The chosen fallback model does not exist');

  const modelId = `${user.username}/${payload.modelName}`;
  const dupes = await db
    .select()
    .from(customModels)
    .where(eq(customModels.modelId, modelId));
  if (dupes.length > 0 && dupes[0]!.id !== id) {
    return jsonError(409, `Model "${modelId}" already exists`);
  }

  const values: Partial<typeof customModels.$inferInsert> = {
    modelId,
    title: payload.title,
    description: payload.description || null,
    acceptedInputs: JSON.stringify(payload.acceptedInputs),
    visibility: payload.visibility,
    rpm: payload.rpm,
    endpointUrl: payload.endpointUrl,
    providerModelId: payload.providerModelId,
    fallbackModelId: payload.fallbackModelId,
  };
  if (payload.bearerToken) {
    values.bearerTokenEnc = encryptSecret(payload.bearerToken);
  }

  const [updated] = await db
    .update(customModels)
    .set(values)
    .where(eq(customModels.id, existing.id))
    .returning();
  return jsonOk({ model: toDTO(updated!) });
}

export async function DELETE(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  const { id } = await params;

  const rows = await db
    .select()
    .from(customModels)
    .where(and(eq(customModels.modelId, id), eq(customModels.userId, user.id)))
    .limit(1);
  const existing = rows[0];
  if (!existing) return jsonError(404, 'Model not found');

  await db.delete(customModels).where(eq(customModels.id, existing.id));
  return jsonOk({ ok: true });
}