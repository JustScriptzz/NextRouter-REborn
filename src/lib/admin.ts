import { kvGetCached } from './kv';

const ADMIN_EMAILS = new Set(['ciullomarco13@gmail.com']);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

let dynamicBanned: string[] = [];
void kvGetCached('banned_emails').then((v) => {
  dynamicBanned = v;
});
const BANNED_REFRESH = setInterval(() => {
  void kvGetCached('banned_emails').then((v) => {
    dynamicBanned = v;
  });
}, 20000);
if (typeof BANNED_REFRESH.unref === 'function') BANNED_REFRESH.unref();

export function isBannedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return dynamicBanned.map((v) => v.toLowerCase()).includes(normalized);
}

export async function isBannedEmailAsync(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const banned = await kvGetCached('banned_emails');
  return banned.map((v) => v.toLowerCase()).includes(normalized);
}
