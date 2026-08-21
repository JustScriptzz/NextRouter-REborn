import { getUserFromApiKey } from '@/lib/auth';
import { jsonErrorCors, jsonOkCors } from '@/lib/http';
import { isUnlimitedEmail } from '@/lib/usage';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getUserFromApiKey(req.headers.get('authorization'));
  if (!user) return jsonErrorCors(401, 'Missing or invalid API key');
  return jsonOkCors({
    id: user.id,
    username: user.username,
    email: user.email,
    limits_removed: isUnlimitedEmail(user.email),
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
}
