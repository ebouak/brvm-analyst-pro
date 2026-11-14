/**
 * Renvoie l'URL si c'est un lien http(s), sinon `null`. À utiliser avant de
 * rendre en `href` une adresse venue de la base ou d'une source tierce :
 * `javascript:` et `data:` s'exécuteraient au clic.
 */
export function urlSure(u: unknown): string | null {
  if (typeof u !== 'string') return null;
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : null;
}
