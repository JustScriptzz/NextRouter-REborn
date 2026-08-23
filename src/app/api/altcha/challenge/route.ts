import { createChallenge, isAltchaEnabled } from '@/lib/altcha';

export const runtime = 'nodejs';

export async function GET() {
  if (!isAltchaEnabled()) {
    return Response.json({ enabled: false });
  }
  const challenge = createChallenge();
  if (!challenge) {
    return Response.json({ enabled: false });
  }
  return Response.json(challenge);
}
