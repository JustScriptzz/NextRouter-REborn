import { getCatalog, getFallbackModelId } from '@/lib/providers';
import { listPublicCustomModels } from '@/lib/customModels';
import { jsonOk } from '@/lib/http';
import type { PublicModelDTO } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const catalog = getCatalog();
  const fallbackId = getFallbackModelId();
  const publicModels = await listPublicCustomModels();
  const models: PublicModelDTO[] = [
    ...catalog.models.map(
      (entry): PublicModelDTO => ({
        id: entry.id,
        type: entry.type,
        title: entry.description,
        isFallback: entry.id === fallbackId,
      }),
    ),
    ...publicModels.map(
      (model): PublicModelDTO => ({
        id: model.modelId,
        type: 'text',
        title: model.title,
        isFallback: false,
      }),
    ),
  ];
  return jsonOk({ models });
}