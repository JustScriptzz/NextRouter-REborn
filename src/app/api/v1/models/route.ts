import { getCatalog } from '@/lib/providers';
import { jsonOkCors } from '@/lib/http';

export const runtime = 'edge';

export async function GET() {
  const catalog = await getCatalog();
  const created = Math.floor(Date.now() / 1000);
  const data = catalog.models.filter((entry) => !entry.id.toLowerCase().includes('kilo')).map((entry) => ({
    id: entry.id,
    object: 'model',
    created,
    owned_by: 'nextrouter',
    type: entry.type,
  }));
  return jsonOkCors({ object: 'list', data });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
}
