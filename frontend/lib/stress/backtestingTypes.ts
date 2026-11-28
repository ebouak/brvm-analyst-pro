// COPIE de scraper/src/stress/pure/backtestingTypes.ts — NE PAS DIVERGER (vérifié par scraper/tests/stressCopie.test.ts).
/**
 * Contrats purs du Historical Backtesting Engine (Phase 3 — WESTBOURSE Stress Monitor).
 * Zéro dépendance I/O. Copié vers `frontend/lib/stress/backtestingTypes.ts`
 * (parité vérifiée par `scraper/tests/stressCopie.test.ts`).
 */

export const SEUILS_BACKTEST = [-5, -10, -15, -20, -25, -30, -40] as const;

export const HORIZONS_MOIS = [1, 3, 6, 12, 24] as const;
export type HorizonMois = (typeof HORIZONS_MOIS)[number];

export const JOURS_PAR_HORIZON: Record<HorizonMois, number> = {
  1: 30,
  3: 91,
  6: 182,
  12: 365,
  24: 730,
};

export type StatutStatistique = 'insuffisant' | 'indicatif' | 'robuste';

export interface ObservationFranchissement {
  date_entree: string;
  valeur_entree: number;
  drawdown_entree_pct: number;
  sommet_precedent: number;
  rendement_pct: number;
  /** Pire baisse supplémentaire depuis `valeur_entree` sur [t .. horizon], en % <= 0. */
  perte_sup_max_pct: number;
  /** Délai calendaire jusqu'au retour au sommet précédent (>= 0 % DD), ou null si non récupéré. */
  delai_retour_sommet_jours: number | null;
}

export interface StatsDistribution {
  n: number;
  moyenne_pct: number | null;
  mediane_pct: number | null;
  ecart_type_pct: number | null;
  min_pct: number | null;
  p10_pct: number | null;
  p25_pct: number | null;
  p75_pct: number | null;
  p90_pct: number | null;
  max_pct: number | null;
  proba_positif_pct: number | null;
  perte_sup_moyenne_pct: number | null;
  perte_sup_pire_pct: number | null;
  delai_retour_sommet_median_jours: number | null;
  /** Intervalle de confiance bootstrap 95 % de la moyenne ; null si n < 5. */
  ic95_moyenne: [number, number] | null;
  /** Vrai si n < 5 (aucune extrapolation statistique autorisée). */
  echantillon_faible: boolean;
  statut_statistique: StatutStatistique;
  observations: ObservationFranchissement[];
}

export interface StatHorizonBacktest {
  horizon_mois: HorizonMois;
  /** Observations espacées d'au moins max(clusteringJours, horizonJours) : zéro chevauchement. */
  independant: StatsDistribution;
  /** Ensemble des franchissements historiques disposant de l'horizon complet. */
  tous_franchissements: StatsDistribution;
}

export interface StatSeuilBacktest {
  seuil_pct: number;
  nb_franchissements_total: number;
  nb_independants_base: number;
  horizons: StatHorizonBacktest[];
}

export type StrategieId =
  | 'buy_and_hold'
  | 'seuil_unique'
  | 'achat_paliers'
  | 'confirmation_stabilisation'
  | 'portefeuille_resilient';

export interface MetriquesPeriodeStrategie {
  debut: string;
  fin: string;
  nb_seances: number;
  rendement_total_pct: number;
  cagr_pct: number | null;
  drawdown_max_pct: number;
  volatilite_ann_pct: number | null;
  ratio_calmar: number | null;
  nb_entrees: number;
  exposition_moyenne_pct: number;
  cout_frais_pct: number;
}

export interface PointCourbeStrategie {
  date: string;
  base100: number;
  drawdown_pct: number;
  exposition_pct: number;
}

export interface ResultatStrategie {
  id: StrategieId;
  libelle: string;
  description: string;
  disponible: boolean;
  raison_indisponibilite?: string | null;
  frais_aller_retour_pct: number;
  globale: MetriquesPeriodeStrategie | null;
  in_sample: MetriquesPeriodeStrategie | null;
  out_of_sample: MetriquesPeriodeStrategie | null;
  courbe_base100: PointCourbeStrategie[];
  avertissements: string[];
}

export interface ActionCoursPoint {
  date_marche: string;
  cours_ajuste: number;
}

export interface FondamentalAnnuelBacktest {
  exercice: number;
  resultat_net: number | null;
  capitaux_propres: number | null;
  date_publication?: string | null;
}

export interface DividendeBacktest {
  exercice: number;
  montant_net: number | null;
  ex_date?: string | null;
}

export interface PortefeuilleResilientActionInput {
  code: string;
  designation: string;
  cours: readonly ActionCoursPoint[];
  fondamentaux: readonly FondamentalAnnuelBacktest[];
  dividendes: readonly DividendeBacktest[];
}

export interface LimitesMethodologiquesBacktest {
  biais_survie: string;
  indice_prix_vs_total_return: string;
  hypothese_cash: string;
  regle_independance: string;
  fenetre_walk_forward: string;
  lag_publication_strategie4: string;
}

export interface SyntheseBacktest {
  date_calcul: string;
  indice_code: string;
  source_mode: 'table_precalculee' | 'calcul_live';
  debut_serie: string | null;
  fin_serie: string | null;
  nb_seances: number;
  drawdown_actuel_pct: number | null;
  frais_aller_retour_pct: number;
  mode_clustering_jours: number;
  stats_seuils: StatSeuilBacktest[];
  strategies: ResultatStrategie[];
  limites_methodologiques: LimitesMethodologiquesBacktest;
}
