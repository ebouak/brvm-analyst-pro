/**
 * Emails autorisés à l'administration (sans dépendance server-only).
 *
 * Source : variable d'environnement `ADMIN_EMAILS` (liste séparée par des
 * virgules, côté serveur uniquement). Repli sur la valeur historique tant que la
 * variable n'est pas posée sur la plateforme, pour ne rien casser en production.
 */
const REPLI = ['ebouak@gmail.com'];

export function lireAdminEmails(env: string | undefined = process.env.ADMIN_EMAILS): string[] {
  const liste = (env ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
  return liste.length > 0 ? liste : REPLI;
}

export const ADMIN_EMAILS = lireAdminEmails();

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
