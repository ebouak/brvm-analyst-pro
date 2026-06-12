/**
 * Note BRVM A–F : traduction du scoring quantitatif (signals_daily) en note
 * lettre mémorisable, façon agence de notation.
 *
 * Échelle d'entrée : score_total ∈ [-1, +1] (cf. scraper/src/scoring/score.ts),
 * seuils moteur BUY = +0.6 / SELL = -0.6. Le barème est aligné sur ces seuils :
 * A = zone BUY, E = zone SELL, C = zone neutre.
 *
 * Règle d'honnêteté : si la confiance est insuffisante (< MIN_CONFIDENCE) ou
 * le score absent, la note est NR (non noté) — jamais de note inventée.
 */

export type RatingNote = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'E' | 'NR';

export interface Rating {
  note: RatingNote;
  /** Ton visuel (mappé sur les tokens du design system). */
  tone: 'up' | 'mid' | 'neutral' | 'down' | 'muted';
  /** Libellé court en français. */
  label: string;
}

/** Confiance minimale pour émettre une note (la neutralisation §9 plafonne à 0.3). */
export const MIN_CONFIDENCE = 0.4;

export function scoreToRating(
  scoreTotal: number | null | undefined,
  confiance: number | null | undefined,
): Rating {
  if (
    scoreTotal == null ||
    !Number.isFinite(scoreTotal) ||
    confiance == null ||
    !Number.isFinite(confiance) ||
    confiance < MIN_CONFIDENCE
  ) {
    return { note: 'NR', tone: 'muted', label: 'Non noté' };
  }

  if (scoreTotal >= 0.75) return { note: 'A+', tone: 'up', label: 'Achat très fort' };
  if (scoreTotal >= 0.6) return { note: 'A', tone: 'up', label: 'Achat' };
  if (scoreTotal >= 0.3) return { note: 'B+', tone: 'mid', label: 'Momentum positif' };
  if (scoreTotal >= 0.1) return { note: 'B', tone: 'mid', label: 'Légèrement positif' };
  if (scoreTotal > -0.1) return { note: 'C', tone: 'neutral', label: 'Neutre' };
  if (scoreTotal > -0.6) return { note: 'D', tone: 'down', label: 'Momentum négatif' };
  return { note: 'E', tone: 'down', label: 'Vente' };
}

export const RATING_DISCLAIMER =
  "Note indicative fondée sur l'analyse technique et les signaux quantitatifs — pas un conseil en investissement.";
