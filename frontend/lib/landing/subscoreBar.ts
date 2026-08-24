/**
 * Géométrie d'une barre de sous-score, **bipolaire et centrée sur zéro**.
 *
 * Pourquoi ce module existe : le hero et RatingSpotlight dessinaient la même
 * grandeur de deux façons différentes, et tous deux mentaient. Une barre
 * remplie de gauche à droite sur l'intervalle [-1,1] affiche un RSI de -1,00
 * comme une barre VIDE et une tendance de 0,00 comme une barre à moitié
 * pleine. Pire, la pénalité de liquidité avait été « corrigée » par une
 * inversion du remplissage, ce qui produisait une barre PLEINE étiquetée
 * « 0.00 » — illisible autrement que comme un bug.
 *
 * Le principe retenu : la piste représente l'intervalle complet, le zéro est
 * matérialisé, et la barre part du zéro vers la valeur. Une valeur nulle ne
 * dessine donc RIEN, une valeur négative part vers la gauche, une positive
 * vers la droite. La forme ne peut plus contredire le chiffre.
 *
 * Les bornes réelles viennent de `scraper/src/scoring/score.ts` :
 * variation / volume / rsi ∈ [-1,1], bonus_tendance ∈ [-0.1,0.1],
 * penalite_liquidite ∈ [0,0.25].
 */

export interface SubscoreBar {
  /** Bord gauche de la barre, en % de la piste. */
  left: number;
  /** Largeur de la barre, en % de la piste. */
  width: number;
  /** Position du zéro sur la piste, en % — sert à tracer le repère. */
  zero: number;
  /** true quand la contribution est défavorable au score. */
  defavorable: boolean;
}

export interface SubscoreBounds {
  min: number;
  max: number;
  /**
   * true pour une PÉNALITÉ : la grandeur est positive mais joue contre le
   * score, donc une valeur élevée est défavorable. Sans ce drapeau, une
   * pénalité de 0,25 se peindrait comme une bonne nouvelle.
   */
  penalite?: boolean;
}

export function subscoreBar(value: number | null, bounds: SubscoreBounds): SubscoreBar | null {
  const { min, max, penalite = false } = bounds;
  if (value == null || !Number.isFinite(value) || max <= min) return null;

  const pos = (v: number) => ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100;
  const zero = pos(0);
  const val = pos(value);

  return {
    left: Math.min(zero, val),
    width: Math.abs(val - zero),
    zero,
    defavorable: penalite ? value > 0 : value < 0,
  };
}

/** Bornes nommées, pour que les appelants ne les recopient pas de mémoire. */
export const BORNES = {
  variation: { min: -1, max: 1 },
  volume: { min: -1, max: 1 },
  rsi: { min: -1, max: 1 },
  tendance: { min: -0.1, max: 0.1 },
  liquidite: { min: 0, max: 0.25, penalite: true },
} as const satisfies Record<string, SubscoreBounds>;
