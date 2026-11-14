/**
 * Estimateur de liquidité — fonction PURE, testée.
 *
 * « Pour placer X FCFA sur ce titre, combien de séances faut-il ? »
 * HYPOTHÈSE, écrite à l'écran : ne pas dépasser une PART de la valeur échangée
 * moyenne (20 % par défaut), au-delà de laquelle un ordre pèse sur le cours.
 *
 * `valeur_moyenne_30j` (liquidity_daily) est la valeur échangée totale divisée
 * par les séances de MARCHÉ (scraper/src/liquidity/compute.ts) : les séances
 * sans échange y comptent déjà pour zéro. Le résultat est donc directement un
 * nombre de séances de marché, sans second ajustement par la présence.
 * C'est un ordre de grandeur, pas une promesse d'exécution.
 */

export const PART_DE_MARCHE = 0.2;

export interface Estimation {
  /** Séances de marché nécessaires. */
  seances: number;
  /** Montant absorbable par séance de marché, sous l'hypothèse de part. */
  parSeance: number;
}

export function estimerSeances(montant: number, valeurMoyenneParSeance: number | null, part = PART_DE_MARCHE): Estimation | null {
  if (!(montant > 0) || valeurMoyenneParSeance == null || !(valeurMoyenneParSeance > 0)) return null;
  const parSeance = valeurMoyenneParSeance * part;
  return { seances: Math.max(1, Math.ceil(montant / parSeance)), parSeance };
}
