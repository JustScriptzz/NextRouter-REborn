import { getCatalog } from '@/lib/providers';
import { jsonOk } from '@/lib/http';
import type { PublicModelDTO } from '@/lib/types';

export const runtime = 'edge';

export async function GET() {
  try {
    const catalog = await getCatalog();
    const fallbackId = catalog.models.find((entry) => entry.type === 'text')?.id ?? null;
    const models: PublicModelDTO[] = catalog.models.map(
      (entry): PublicModelDTO => ({
        id: entry.id,
        type: entry.type,
        title: entry.description,
        isFallback: entry.id === fallbackId,
      }),
    );
    return jsonOk({ models });
  } catch (error) {
    console.error('[GET /api/models] Error:', error);
    return jsonOk({ models: [] });
  }
}
