const ADMIN_EMAILS = new Set(['ciullomarco13@gmail.com']);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}
