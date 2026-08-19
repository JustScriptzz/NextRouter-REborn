import { eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';
import { encryptSecret } from '@/lib/crypto';
import { countUserCustomModels, listUserCustomModels, toDTO } from '@/lib/customModels';
import { db } from '@/lib/db/client';
import { customModels } from '@/lib/db/schema';
import { jsonError, jsonOk } from '@/lib/http';
import { getCatalogModel } from '@/lib/providers';
import { validateCustomModelPayload } from '@/lib/validation';

export const runtime = 'nodejs';

const MAX_CUSTOM_MODELS = 100;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');
  const models = await listUserCustomModels(user.id);
  return jsonOk({ models });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, 'Not signed in');

  const raw = await req.json().catch(() => null);
  const validated = validateCustomModelPayload(raw);
  if (!validated.ok) return jsonError(400, validated.message);
  const payload = validated.payload;

  if (payload.bearerToken && payload.bearerToken.length > 1024) {
    return jsonError(400, 'API bearer token is too long');
  }

  const fallback = getCatalogModel(payload.fallbackModelId);
  if (!fallback) return jsonError(400, 'The chosen fallback model does not exist');

  const modelId = `${user.username}/${payload.modelName}`;
  const existing = await db
    .select()
    .from(customModels)
    .where(eq(customModels.modelId, modelId))
    .limit(1);
  if (existing.length > 0) return jsonError(409, `Model "${modelId}" already exists`);

  const count = await countUserCustomModels(user.id);
  if (count >= MAX_CUSTOM_MODELS) {
    return jsonError(400, `You can have at most ${MAX_CUSTOM_MODELS} custom models`);
  }

  const bearerTokenEnc = payload.bearerToken ? encryptSecret(payload.bearerToken) : null;
  const [row] = await db
    .insert(customModels)
    .values({
      userId: user.id,
      modelId,
      title: payload.title,
      description: payload.description || null,
      acceptedInputs: JSON.stringify(payload.acceptedInputs),
      visibility: payload.visibility,
      rpm: payload.rpm,
      endpointUrl: payload.endpointUrl,
      providerModelId: payload.providerModelId,
      bearerTokenEnc,
      fallbackModelId: payload.fallbackModelId,
    })
    .returning();

  return jsonOk({ model: toDTO(row!) }, 201);
}