/** Emails autorisés à l'administration (sans dépendance server-only). */
export const ADMIN_EMAILS = ['ebouak@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
