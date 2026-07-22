import type { Levels } from './levels';

/** Entrée de sélection : une valeur avec sa semaine et son historique. */
export interface HebdoCandidate {
  code: string;
  /** Clôtures chronologiques (≥ 32 points requis pour être retenu). */
  closes: number[];
  /** Variation de la semaine, en %. */
  variationHebdo: number | null;
  /** Volume de la dernière séance. */
  volume: number | null;
  /** Volume moyen 20 séances. */
  avgVolume20: number | null;
}

export interface HebdoPick {
  code: string;
  sens: 'hausse' | 'baisse';
  raison: string;
  score: number;
}

/** Snapshot figé stocké dans hebdo_items.metrics (rendu de la page). */
export interface HebdoMetrics {
  code: string;
  dates: string[];
  closes: number[];
  rsi: (number | null)[];
  dernier: number;
  variationHebdo: number | null;
  volume: number | null;
  ratioVolume: number | null;
  rsiDernier: number | null;
  macdPositif: boolean | null;
  levels: Levels | null;
}

/** Éclairages optionnels injectés dans le narratif (spec §3 et §4). */
export interface HebdoContexte {
  fondamental: { phrase: string; chiffres: number[] } | null;
  evenement: { phrase: string; chiffres: number[] } | null;
}
