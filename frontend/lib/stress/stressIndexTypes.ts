// COPIE de scraper/src/stress/pure/stressIndexTypes.ts — NE PAS DIVERGER (vérifié par scraper/tests/stressCopie.test.ts).
/**
 * Contrats purs du BRVM Market Stress Index 0-100 (Phase 4 — WESTBOURSE Stress Monitor).
 * Zéro dépendance I/O, aucun signal d'achat/vente : thermomètre descriptif contemporain.
 *
 * Copié vers `frontend/lib/stress/stressIndexTypes.ts`
 * (parité vérifiée par `scraper/tests/stressCopie.test.ts`).
 */

export type RegimeStress =
  | 'faible_tension'
  | 'tension_moderee'
  | 'tension_elevee'
  | 'tension_extreme';

export const LIBELLES_REGIMES_STRESS: Record<RegimeStress, string> = {
  faible_tension: 'Faible tension (0–25)',
  tension_moderee: 'Tension modérée (25–50)',
  tension_elevee: 'Tension élevée (50–75)',
  tension_extreme: 'Tension extrême (75–100)',
};

export type CleComposanteStress =
  | 'drawdown_composite'
  | 'largeur_baissiere'
  | 'volatilite_brvmv'
  | 'diffusion_sectorielle'
  | 'pression_volumes'
  | 'momentum_court_terme';

export const POIDS_NOMINAUX_STRESS: Record<CleComposanteStress, number> = {
  drawdown_composite: 0.25,
  largeur_baissiere: 0.20,
  volatilite_brvmv: 0.15,
  diffusion_sectorielle: 0.15,
  pression_volumes: 0.15,
  momentum_court_terme: 0.10,
};

export const LIBELLES_COMPOSANTES_STRESS: Record<CleComposanteStress, string> = {
  drawdown_composite: 'Drawdown du BRVM Composite',
  largeur_baissiere: 'Largeur baissière (5 séances)',
  volatilite_brvmv: 'Volatilité réalisée BRVM-V',
  diffusion_sectorielle: 'Diffusion sectorielle des baisses (20 séances)',
  pression_volumes: 'Part des volumes sur titres en baisse (5 séances)',
  momentum_court_terme: 'Momentum baissier court terme (20 séances)',
};

export interface DetailComposanteStress {
  valeur_brute: number | null;
  unite_brute: string;
  score_0_100: number | null;
  poids_nominal: number;
  poids_effectif: number;
}

export type MapComposantesStress = Record<CleComposanteStress, DetailComposanteStress>;

/**
 * Quatre indicateurs d'observation factuels affichés côte à côte (sans verdict
 * ni feu tricolore, le banc d'évaluation 2007-2026 ayant conclu `non_prouve`).
 */
export interface ObservablesMarcheStress {
  brvmc_cloture: number;
  drawdown_brvmc_pct: number;
  largeur_hausses_5j_pct: number | null;
  ecart_brvmc_mm20_pct: number | null;
  variation_brvmv_20j_pts: number | null;
  ratio_volume_60j: number | null;
}

export interface StressDailyRow {
  date_marche: string;
  stress_index: number;
  regime: RegimeStress;
  couverture_composantes_pct: number;
  nb_composantes_actives: number;
  composantes: MapComposantesStress;
  variation_5j_pts: number | null;
  variation_20j_pts: number | null;
  variation_60j_pts: number | null;
  observables_marche: ObservablesMarcheStress;
}

export interface ActionSeanceStressInput {
  date_marche: string;
  code: string;
  secteur: string;
  capitalisation: number | null;
  cours_jour: number;
  variation_pct: number | null;
  volume: number | null;
}

export interface NervositeStressInput {
  date_marche: string;
  valeur: number | null;
  rang: number | null;
}
