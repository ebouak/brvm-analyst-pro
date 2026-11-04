import { createHash } from 'node:crypto';

export const LONGUEUR_MIN = 3;
export const LONGUEUR_MAX = 150;

/** Minuscules, sans accents, ponctuation remplacée par une espace, espaces réduites. */
export function normaliser(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Clé de cache : seule l'empreinte est stockée, jamais le texte. */
export function empreinte(q: string): string {
  return createHash('sha256').update(normaliser(q)).digest('hex');
}

/** Clé de quota : l'identifiant du compte n'est jamais stocké en clair. */
export function hacherIdentifiant(id: string): string {
  return createHash('sha256').update(`recherche-societes:${id}`).digest('hex').slice(0, 32);
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// Huit chiffres ou plus, séparateurs usuels admis : un numéro de téléphone.
const TELEPHONE = /(?:\+|00)?\d(?:[\s.\-()]*\d){7,}/;
// Un montant usuel (« 1 000 000 ») n'est pas un numéro : groupes de trois chiffres.
const MONTANT = /\b\d{1,3}(?:[   ]\d{3})+\b/g;

export function contientDonneePersonnelle(q: string): boolean {
  if (EMAIL.test(q)) return true;
  return TELEPHONE.test(q.replace(MONTANT, ' '));
}

export type RequeteValidee = { ok: true; q: string } | { ok: false; erreur: 'longueur' | 'donnee_personnelle' };

export function validerRequete(q: unknown): RequeteValidee {
  if (typeof q !== 'string') return { ok: false, erreur: 'longueur' };
  const t = q.trim();
  if (t.length < LONGUEUR_MIN || t.length > LONGUEUR_MAX) return { ok: false, erreur: 'longueur' };
  if (contientDonneePersonnelle(t)) return { ok: false, erreur: 'donnee_personnelle' };
  return { ok: true, q: t };
}
