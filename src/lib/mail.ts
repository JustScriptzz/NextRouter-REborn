import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const MAIL_FROM = process.env.MAIL_FROM || 'NextRouter <no-reply@localhost>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nextrouter-vert.vercel.app';

export function isSmtpConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

const transporter = isSmtpConfigured()
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

function htmlTemplate(title: string, bodyHtml: string, actionHref?: string, actionLabel?: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#000000;color:#ffffff;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px auto;border:0.5px solid #2d2d2d;border-radius:12px;background:#0a0a0a;">
    <tr><td style="padding:20px 24px;border-bottom:0.5px solid #2d2d2d;">
      <span style="font-family:monospace;font-size:12px;letter-spacing:0.08em;color:#888888;">NextRouter REborn — Engineered by JustScriptzz</span>
    </td></tr>
    <tr><td style="padding:32px 24px;">
      <h1 style="font-weight:700;font-size:20px;margin:0 0 12px;color:#ffffff;">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#a1a1aa;">${bodyHtml}</div>
      ${
        actionHref
          ? `<p style="margin:24px 0 0;"><a href="${actionHref}" style="display:inline-block;background:#ffffff;color:#000000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${actionLabel}</a></p>`
          : ''
      }
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:0.5px solid #2d2d2d;font-size:11px;color:#666666;text-align:center;">
      NextRouter REborn — unified AI gateway
    </td></tr>
  </table>
</body>
</html>`;
}

export interface SendMailResult { ok: boolean; error?: string; disabled?: boolean }

export async function sendVerifyEmail(
  to: string,
  token: string,
): Promise<SendMailResult> {
  if (!isSmtpConfigured() || !transporter) {
    return { ok: false, disabled: true, error: 'SMTP is not configured' };
  }
  const verifyUrl = `${APP_URL}/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}`;
  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject: 'Verify your email — NextRouter REborn',
      html: htmlTemplate(
        'Please verify your email address',
        `Welcome to NextRouter. To activate your account, click the button below to confirm that this email address belongs to you.`,
        verifyUrl,
        'Verify email',
      ),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Mail send failed' };
  }
}

export function appUrl(): string {
  return APP_URL;
}