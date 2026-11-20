// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
// Régénérer avec `node scripts/sync-hebdo-pure.mjs` (vérifié par tests/hebdoCopies.test.ts).
/**
 * Quand un dividende peut-il être présenté comme un « rendement au cours du
 * jour » dans un texte publié ? Module PUR, source unique de la règle pour les
 * articles (scraper/src/articles), l'analyse hebdo et le décryptage valeur.
 *
 * POURQUOI. Le 2026-11-19, l'article de séance FTSC a écrit « dividende de
 * 1 726,56 F au titre de l'exercice 2024, soit 108,59 % au cours du jour ». Le
 * montant était exact (distribution exceptionnelle votée par l'AG du
 * 23/05/2025, payée le 30/09/2025), mais le rapporter au cours de novembre 2026
 * faisait d'un versement ponctuel, payé quatorze mois plus tôt, un rendement.
 *
 * LA RÈGLE. Pas de rendement si le dividende est :
 *   - ANCIEN : payé il y a plus de 12 mois ; sans date de paiement, la séance
 *     est postérieure à la fin de l'exercice + 18 mois (un dividende de
 *     l'exercice N se paie d'ordinaire au cours de N+1) ;
 *   - ANORMAL : plus de 3 fois la médiane des exercices précédents connus
 *     (montants > 0), ou rendement calculé supérieur à 25 %.
 * Il reste alors citable comme « dernier dividende versé », avec son exercice
 * et sa date de paiement, sans rapport au cours.
 *
 * Une ligne à montant 0 ou nul n'est PAS « pas de dividende » : c'est une
 * donnée absente (68 lignes sikafinance à zéro, audit du 2026-09-08). Elle est
 * ignorée, et on n'en tire aucune conclusion. Aucun adjectif (« exceptionnel »)
 * n'est produit ici : la base ne porte aucune source qui le dise.
 */

export interface LigneDividende {
  exercice: number | null;
  montant: number | null;
  payment_date?: string | null;
}

export type LectureDividende =
  | { mode: 'rendement'; exercice: number; montant: number; payment_date: string | null; rendementPct: number }
  | { mode: 'sans_rendement'; exercice: number; montant: number; payment_date: string | null; motif: 'ancien' | 'anormal' };

/** Au-delà, un dividende payé ne décrit plus la politique de distribution actuelle. */
export const ANCIENNETE_MOIS = 12;
/** Sans date de paiement : fin de l'exercice + ce délai. */
export const RECUL_SANS_DATE_MOIS = 18;
/** Un montant supérieur à ce multiple de la médiane des exercices précédents est anormal. */
export const FACTEUR_ANORMAL = 3;
/** Un rendement calculé au-delà est anormal, quel que soit l'historique. */
export const RENDEMENT_MAX_PCT = 25;

const ISO = /^\d{4}-\d{2}-\d{2}/;

/** Date ISO (AAAA-MM-JJ) décalée de `mois` mois, au jour près (fin de mois ramenée). */
function decalerMois(iso: string, mois: number): string {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const total = a * 12 + (m - 1) + mois;
  const an = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const dernierJour = new Date(Date.UTC(an, mo, 0)).getUTCDate();
  return `${an}-${String(mo).padStart(2, '0')}-${String(Math.min(j, dernierJour)).padStart(2, '0')}`;
}

const positif = (l: LigneDividende): l is LigneDividende & { exercice: number; montant: number } =>
  l.exercice != null && l.montant != null && Number.isFinite(l.montant) && l.montant > 0;

function mediane(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2;
}

/** Payé il y a plus de 12 mois (ou, sans date, séance après fin d'exercice + 18 mois). */
export function dividendeAncien(d: LigneDividende, dateSeance: string): boolean {
  if (!ISO.test(dateSeance)) return false;
  const seance = dateSeance.slice(0, 10);
  if (d.payment_date && ISO.test(d.payment_date)) return d.payment_date.slice(0, 10) < decalerMois(seance, -ANCIENNETE_MOIS);
  if (d.exercice == null) return false;
  return seance > decalerMois(`${d.exercice}-12-31`, RECUL_SANS_DATE_MOIS);
}

/** Plus de 3 fois la médiane des exercices ANTÉRIEURS connus (> 0). Sans antécédent, rien à comparer. */
export function dividendeHorsHistorique(d: LigneDividende, lignes: LigneDividende[]): boolean {
  if (!positif(d)) return false;
  const m = mediane(lignes.filter(positif).filter((l) => l.exercice < d.exercice).map((l) => l.montant));
  return m != null && m > 0 && d.montant > FACTEUR_ANORMAL * m;
}

/**
 * Dernier dividende exploitable (montant > 0, exercice connu) et ce qu'un texte
 * publié peut en dire. `lignes` : toutes les lignes connues de la valeur, dans
 * n'importe quel ordre ; les montants nuls sont ignorés. null : rien à dire.
 */
export function lireDividende(lignes: LigneDividende[], cours: number | null, dateSeance: string): LectureDividende | null {
  const d = lignes.filter(positif).sort((a, b) => b.exercice - a.exercice)[0];
  if (!d) return null;
  const base = { exercice: d.exercice, montant: d.montant, payment_date: d.payment_date ?? null };
  if (dividendeAncien(d, dateSeance)) return { mode: 'sans_rendement', ...base, motif: 'ancien' };
  const rendementPct = cours != null && cours > 0 ? (d.montant / cours) * 100 : null;
  if (dividendeHorsHistorique(d, lignes) || (rendementPct != null && rendementPct > RENDEMENT_MAX_PCT)) {
    return { mode: 'sans_rendement', ...base, motif: 'anormal' };
  }
  if (rendementPct == null) return null;
  return { mode: 'rendement', ...base, rendementPct };
}
