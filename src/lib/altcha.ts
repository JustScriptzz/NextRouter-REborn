import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const MAX_NUMBER = 100000;

export function getAltchaSecret(): string | null {
  const secret = process.env.ALTCHA_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

export function isAltchaEnabled(): boolean {
  return getAltchaSecret() !== null;
}

export function createChallenge(): {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
} | null {
  const secret = getAltchaSecret();
  if (!secret) return null;
  const salt = randomBytes(12).toString('hex');
  const number = Math.floor(Math.random() * MAX_NUMBER);
  const challenge = createHash('sha256').update(salt + String(number)).digest('hex');
  const signature = createHmac('sha256', secret).update(challenge).digest('hex');
  return { algorithm: 'SHA-256', challenge, maxnumber: MAX_NUMBER, salt, signature };
}

export function verifySolution(payloadB64: unknown): boolean {
  const secret = getAltchaSecret();
  if (!secret) return true;
  if (typeof payloadB64 !== 'string' || !payloadB64) return false;
  try {
    const data = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8')) as {
      challenge?: string;
      number?: number;
      salt?: string;
      signature?: string;
    };
    if (!data.challenge || !data.salt || !data.signature || typeof data.number !== 'number') {
      return false;
    }
    const expectedSig = createHmac('sha256', secret).update(data.challenge).digest('hex');
    const a = Buffer.from(expectedSig, 'hex');
    const b = Buffer.from(data.signature, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const hash = createHash('sha256').update(data.salt + String(data.number)).digest('hex');
    return hash === data.challenge;
  } catch {
    return false;
  }
}
