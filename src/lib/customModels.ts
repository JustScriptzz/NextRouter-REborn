import { desc, eq } from 'drizzle-orm';
import { db } from './db/client';
import { customModels } from './db/schema';
import type { CustomModelDTO, ModelKind, SessionUser } from './types';

function parseInputs(raw: string | null): ModelKind[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed.filter(isModelKind) as ModelKind[]) : [];
  } catch {
    return [];
  }
}

function isModelKind(value: unknown): value is ModelKind {
  return value === 'text' || value === 'image' || value === 'tts' || value === 'stt' || value === 'video';
}

export function serializeInputs(inputs: ModelKind[]): string {
  return JSON.stringify(inputs);
}

export function toDTO(row: (typeof customModels)['$inferSelect']): CustomModelDTO {
  return {
    id: row.id,
    modelId: row.modelId,
    title: row.title,
    description: row.description,
    acceptedInputs: parseInputs(row.acceptedInputs),
    visibility: row.visibility === 'public' ? 'public' : 'private',
    rpm: row.rpm,
    endpointUrl: row.endpointUrl,
    providerModelId: row.providerModelId,
    fallbackModelId: row.fallbackModelId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUserCustomModels(userId: string): Promise<CustomModelDTO[]> {
  const rows = await db
    .select()
    .from(customModels)
    .where(eq(customModels.userId, userId))
    .orderBy(desc(customModels.createdAt));
  return rows.map(toDTO);
}

export async function listPublicCustomModels(): Promise<CustomModelDTO[]> {
  const rows = await db
    .select()
    .from(customModels)
    .where(eq(customModels.visibility, 'public'))
    .orderBy(desc(customModels.createdAt));
  return rows.map(toDTO);
}

export async function findCustomModelForCaller(
  modelId: string,
  caller: SessionUser,
): Promise<(typeof customModels)['$inferSelect'] | null> {
  const rows = await db.select().from(customModels).where(eq(customModels.modelId, modelId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.visibility !== 'public' && row.userId !== caller.id) return null;
  return row;
}

export async function countUserCustomModels(userId: string): Promise<number> {
  const rows = await db
    .select({ count: customModels.id })
    .from(customModels)
    .where(eq(customModels.userId, userId));
  return rows.length;
}