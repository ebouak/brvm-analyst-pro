/**
 * Secret d'impression des dossiers valeur : video/dossiers.mjs imprime la page
 * en PDF avec Chromium, sans session, en présentant DOSSIER_RENDER_SECRET dans
 * l'en-tête `x-dossier-render` — jamais dans l'URL, qui finirait dans les
 * journaux d'accès.
 *
 * Lu à deux endroits : le middleware (mur de connexion) et la page elle-même
 * (verrou Premium, le robot n'ayant pas d'abonnement). PUR et compatible Edge :
 * `node:crypto` n'existe pas dans le middleware, d'où la comparaison à temps
 * constant écrite à la main. Un secret de moins de 32 caractères est refusé :
 * mieux vaut un cron en échec qu'un mur gardé par « test ».
 */
export const EN_TETE_RENDU = 'x-dossier-render';
export const PREFIXE_RENDU = '/rapports/dossier/';

export function secretRenduValide(attendu: string | undefined, fourni: string | null | undefined): boolean {
  if (!attendu || !fourni || attendu.length < 32) return false;
  let diff = attendu.length ^ fourni.length;
  for (let i = 0; i < attendu.length; i++) {
    diff |= attendu.charCodeAt(i) ^ (fourni.charCodeAt(i % fourni.length) || 0);
  }
  return diff === 0;
}
