import { PUBLIC_API_KEY, PUBLIC_DAILY_PER_IP, PUBLIC_RPM_PER_IP } from '@/lib/public-access';
import { jsonOk } from '@/lib/http';

export const runtime = 'edge';

// The key is public by design (shown on /docs and /keys) — this just lets
// the Playground fetch it plus the current limits without hardcoding.
export async function GET() {
  return jsonOk({
    key: PUBLIC_API_KEY,
    rpmPerIp: PUBLIC_RPM_PER_IP,
    dailyPerIp: PUBLIC_DAILY_PER_IP,
  });
}
