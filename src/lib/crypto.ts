import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is not configured');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex ?? '', 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex ?? '', 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex ?? '', 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}