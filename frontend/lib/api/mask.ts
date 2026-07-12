/**
 * Affichage d'une clé d'API — utilisable côté client.
 *
 * Volontairement séparé de `keys.ts` : celui-ci importe `node:crypto` (génération
 * et hachage) et ne doit JAMAIS être bundlé pour le navigateur. Un composant
 * client n'a besoin que du masquage.
 */

/** Masque une clé pour l'affichage (ne montre jamais le secret complet). */
export function maskKey(prefix: string | null | undefined): string {
  return prefix ? `${prefix}${'•'.repeat(12)}` : '—';
}
