import { kvGetCached } from './config-store';

const DEFAULT_BLOCKED_DOMAINS = [
  'mailinator.com',
  'yopmail.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  '10minutemail.com',
  '10minutemail.net',
  'temp-mail.org',
  'temp-mail.io',
  'tempmail.com',
  'tempmailo.com',
  'tmpmail.org',
  'tmpmail.net',
  'throwawaymail.com',
  'getnada.com',
  'nada.email',
  'dispostable.com',
  'maildrop.cc',
  'mintemail.com',
  'trashmail.com',
  'trash-mail.com',
  'fakeinbox.com',
  'mailnesia.com',
  'tempinbox.com',
  'emailondeck.com',
  'mailcatch.com',
  'spam4.me',
  'grr.la',
  'moakt.com',
  'mohmal.com',
  'email-temp.com',
  'tempr.email',
  'tmail.ws',
  'tmails.net',
  '1secmail.com',
  '1secmail.org',
  '1secmail.net',
  'esiix.com',
  'wwjmp.com',
  'xojxe.com',
  'yoggm.com',
  'mail.tm',
  'mail.gw',
  'dropmail.me',
  'mytemp.email',
  'burnermail.io',
  'minuteinbox.com',
  'linshiyouxiang.net',
  'tempmail.plus',
];

let dynamicBlocked: string[] = [];
void kvGetCached('blocked_email_domains').then((v) => {
  dynamicBlocked = v;
});
const BLOCKED_REFRESH = setInterval(() => {
  void kvGetCached('blocked_email_domains').then((v) => {
    dynamicBlocked = v;
  });
}, 20000);
if (typeof BLOCKED_REFRESH.unref === 'function') BLOCKED_REFRESH.unref();

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;
  for (const blocked of [...DEFAULT_BLOCKED_DOMAINS, ...dynamicBlocked]) {
    const b = blocked.toLowerCase().trim();
    if (!b) continue;
    if (domain === b || domain.endsWith('.' + b)) return true;
  }
  return false;
}
