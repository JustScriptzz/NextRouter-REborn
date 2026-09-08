import { PUBLIC_API_KEY, PUBLIC_RPM_PER_IP } from '@/lib/public-access';
import { jsonOk } from '@/lib/http';

export const runtime = 'nodejs';

// The key is public by design (documented on /docs) — this just lets the
// Playground and Keys page fetch it without minting per-user keys.
export async function GET() {
  return jsonOk({ key: PUBLIC_API_KEY, rpmPerIp: PUBLIC_RPM_PER_IP });
}
