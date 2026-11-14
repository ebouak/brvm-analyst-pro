/**
 * Accès de rendu serveur-à-serveur du relevé mensuel — PUR et compatible Edge.
 *
 * DONNÉES PRIVÉES. Contrairement au dossier valeur (qui ne contient que du
 * marché et s'ouvre avec un secret partagé), le relevé contient le portefeuille
 * d'un utilisateur. Le worker d'impression (video/releves.mjs) n'a pas de
 * session : il présente, dans l'en-tête `x-releve-render`, un JETON ALÉATOIRE à
 * usage unique, propre à UN relevé, valable 5 minutes. Seul son SHA-256 est
 * stocké (monthly_reports.rendu_jeton_hash). Le secret DOSSIER_RENDER_SECRET
 * n'est PAS utilisé ici : s'il fuyait, il ne devrait jamais ouvrir un
 * portefeuille.
 *
 * Deux lecteurs : le middleware (qui laisse passer jusqu'à la page une requête
 * sans session mais portant un jeton de forme valide) et la page (qui valide
 * vraiment, puis consomme le jeton). Le middleware ne valide RIEN de plus que
 * la forme : l'autorité est la page.
 */
export const EN_TETE_RELEVE = 'x-releve-render';
export const PREFIXE_RELEVE = '/rapports/releve/';
/** Durée de validité d'un jeton, côté worker. */
export const DUREE_JETON_MS = 5 * 60 * 1000;

const FORME_JETON = /^[0-9a-f]{64}$/; // 32 octets en hexadécimal
const FORME_HASH = /^[0-9a-f]{64}$/; // SHA-256 en hexadécimal
const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const jetonRenduPlausible = (v: string | null | undefined): v is string => !!v && FORME_JETON.test(v);
export const hashPlausible = (v: string | null | undefined): v is string => !!v && FORME_HASH.test(v);
export const idReleveValide = (v: string): boolean => FORME_UUID.test(v);

/**
 * Égalité de deux chaînes en temps constant (la durée ne dépend pas de la
 * position de la première différence). `node:crypto` n'existe pas en Edge,
 * d'où l'écriture à la main — même parti pris que `secretRenduValide`.
 */
export function egalTempsConstant(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export type DecisionAcces = 'proprietaire' | 'jeton' | 'refus';

/**
 * Décision d'accès à la page d'un relevé. Autorisé SI ET SEULEMENT SI :
 *  (a) la session est celle du propriétaire de la ligne ; OU
 *  (b) le SHA-256 du jeton présenté égale `rendu_jeton_hash` (temps constant)
 *      ET l'expiration est dans le futur.
 * Tout le reste est un refus, y compris toute donnée manquante ou malformée.
 */
export function evaluerAcces(i: {
  sessionUserId: string | null;
  ligneUserId: string | null;
  hashAttendu: string | null;
  expire: string | null;
  hashFourni: string | null;
  maintenant: Date;
}): DecisionAcces {
  if (i.sessionUserId && i.ligneUserId && egalTempsConstant(i.sessionUserId, i.ligneUserId)) return 'proprietaire';
  if (!hashPlausible(i.hashAttendu) || !hashPlausible(i.hashFourni) || !i.expire) return 'refus';
  const fin = Date.parse(i.expire);
  if (!Number.isFinite(fin) || !(fin > i.maintenant.getTime())) return 'refus';
  return egalTempsConstant(i.hashAttendu, i.hashFourni) ? 'jeton' : 'refus';
}
