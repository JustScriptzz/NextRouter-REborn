import { getUserFromApiKey } from '@/lib/auth';
import { listPublicCustomModels } from '@/lib/customModels';
import { getCatalog } from '@/lib/providers';
import { jsonErrorCors, jsonOkCors } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getUserFromApiKey(req.headers.get('authorization'));
  if (!user) return jsonErrorCors(401, 'Missing or invalid API key');

  const catalog = getCatalog();
  const publicCustom = await listPublicCustomModels();
  const created = Math.floor(Date.now() / 1000);

  const data = [
    ...catalog.models.map((entry) => ({
      id: entry.id,
      object: 'model',
      created,
      owned_by: 'nextrouter',
      type: entry.type,
    })),
    ...publicCustom.map((model) => ({
      id: model.modelId,
      object: 'model',
      created: Math.floor(new Date(model.createdAt).getTime() / 1000),
      owned_by: 'community',
      type: 'text',
    })),
  ];
  return jsonOkCors({ object: 'list', data });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
}