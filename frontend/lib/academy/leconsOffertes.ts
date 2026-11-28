/**
 * Leçons de l'Academy offertes sans achat.
 *
 * Une leçon offerte se reconnaît à son cours ET au début de son titre, jamais
 * à sa seule position : l'ajout du Module 0 au Niveau 2 (novembre 2026) a
 * décalé toutes ses leçons de huit places. Repérée par sa position, la leçon
 * offerte serait devenue une autre leçon sans que rien ne le signale. Un titre
 * qui ne correspond plus FERME l'offre : on ne donne jamais une leçon par erreur.
 *
 * Deux régimes :
 *  - `public` : ouverte à tous, sans compte (sert le référencement) ;
 *  - `compte` : ouverte à toute personne connectée, même sans achat. C'est
 *    elle qui fait créer un compte gratuit.
 *
 * `numero` (à partir de 1) ne sert qu'à construire les liens. S'il devient
 * faux après un réordonnancement, le lien mène à l'aperçu d'une autre leçon,
 * où la leçon offerte reste signalée : l'accès, lui, ne dépend que du titre.
 */

export type AccesOffert = 'public' | 'compte';

export interface LeconOfferte {
  slug: string;
  /** Position actuelle, pour les liens seulement (1 = première leçon). */
  numero: number;
  /** Début du titre tel qu'il figure dans `academy_courses.content`. */
  debutTitre: string;
  acces: AccesOffert;
  /** Étiquette courte (catalogue). */
  badge: string;
  /** Appel à l'action du catalogue. */
  cta: string;
}

export const LECONS_OFFERTES: readonly LeconOfferte[] = [
  {
    slug: 'academy-niveau-1-initiation',
    numero: 1,
    debutTitre: 'Leçon 1 —',
    acces: 'public',
    badge: 'Leçon 1 offerte',
    cta: 'Essayer la Leçon 1 gratuite →',
  },
  {
    slug: 'academy-niveau-2-fondamental',
    numero: 9,
    debutTitre: 'Leçon 1 — Lire un rapport annuel',
    acces: 'compte',
    badge: 'Cas Sonatel offert',
    cta: 'Lire le cas Sonatel gratuitement →',
  },
];

function normaliser(t: string): string {
  return t
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '—')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fr');
}

/** Régime d'accès offert à la leçon de ce titre dans ce cours, ou `null`. */
export function accesOffert(slug: string, titre: string | null | undefined): AccesOffert | null {
  if (!titre) return null;
  const t = normaliser(titre);
  const offre = LECONS_OFFERTES.find((o) => o.slug === slug && t.startsWith(normaliser(o.debutTitre)));
  return offre?.acces ?? null;
}

/** La leçon s'ouvre-t-elle sans achat ? Le régime `compte` exige une session. */
export function leconOuverte(acces: AccesOffert | null, connecte: boolean): boolean {
  return acces === 'public' || (acces === 'compte' && connecte);
}

/** L'offre d'un cours (catalogue : badge, lien, appel à l'action). */
export function offreDuCours(slug: string): LeconOfferte | null {
  return LECONS_OFFERTES.find((o) => o.slug === slug) ?? null;
}

/** Lien vers la leçon offerte d'un cours. */
export function lienOffre(o: LeconOfferte): string {
  return `/formations/academy/${o.slug}?lecon=${o.numero}`;
}
