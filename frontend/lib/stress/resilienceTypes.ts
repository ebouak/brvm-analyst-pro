// COPIE de scraper/src/stress/pure/resilienceTypes.ts — NE PAS DIVERGER (vérifié par scraper/tests/stressCopie.test.ts).
/**
 * Contrats purs du Stock Resilience Scanner (Phase 2 — WESTBOURSE Stress Monitor).
 * Zéro dépendance I/O. Copié vers `frontend/lib/stress/resilienceTypes.ts`
 * (vérifié par `scraper/tests/stressCopie.test.ts`).
 */

export type FamilleComptable = 'banque' | 'assurance' | 'general';

export type CategorieOpportunite =
  | 'qualite_elevee'
  | 'potentiel_a_etudier'
  | 'vigilance'
  | 'risque_eleve';

export const LIBELLES_CATEGORIES: Record<CategorieOpportunite, string> = {
  qualite_elevee: 'Résilience & comptes solides',
  potentiel_a_etudier: 'Repli marqué · comptes solides',
  vigilance: 'Profil mixte ou incomplet',
  risque_eleve: 'Fragilité observée',
};

export interface PoidsScoreOpportunite {
  qualiteFinanciere: number;
  valorisation: number;
  dividendes: number;
  resilienceHistorique: number;
  liquidite: number;
  momentumStabilisation: number;
}

export const POIDS_OPPORTUNITE_DEFAUT: PoidsScoreOpportunite = {
  qualiteFinanciere: 0.25,
  valorisation: 0.20,
  dividendes: 0.15,
  resilienceHistorique: 0.15,
  liquidite: 0.15,
  momentumStabilisation: 0.10,
};

export interface FondamentauxAnalyse {
  exercice: string | null;
  /** Âge des états financiers en années par rapport à la date d'analyse. */
  age_annees: number | null;
  famille_comptable: FamilleComptable;
  chiffre_affaires: number | null;
  resultat_exploitation: number | null;
  resultat_net: number | null;
  capitaux_propres: number | null;
  dette_totale: number | null;
  tresorerie: number | null;
  flux_tresorerie_libre: number | null;
  roe_pct: number | null;
  roa_pct: number | null;
  marge_nette_pct: number | null;
  per: number | null;
  pbr: number | null;
  price_to_sales: number | null;
  ev_ebitda: number | null;
  gearing_pct: number | null;
  couverture_interets: number | null;
  // Spécifiques bancaires (jamais comparés directement aux valeurs industrielles)
  pnb: number | null;
  coefficient_exploitation_pct: number | null;
  cout_du_risque: number | null;
  taux_creances_souffrance_pct: number | null;
  ratio_solvabilite_pct: number | null;
  // Comparaison sectorielle
  per_median_secteur: number | null;
  pbr_median_secteur: number | null;
  croissance_rn_pct: number | null;
}

export interface DividendesAnalyse {
  dernier_exercice: number | null;
  montant_net: number | null;
  montant_brut: number | null;
  base_fiscale: 'net' | 'brut' | 'inconnu';
  rendement_pct: number | null;
  taux_distribution_pct: number | null;
  annees_consecutives_5a: number;
  derniere_ex_date: string | null;
  croissance_div_pct: number | null;
}

export interface LiquiditeAnalyse {
  score_v2: number | null;
  classe: string | null;
  presence_pct: number | null;
  valeur_moyenne_30j: number | null;
  amihud: number | null;
  spread_pct: number | null;
  flux_net_pct: number | null;
  seances_cotees_60j: number;
}

export type FacteurDecrochageType =
  | 'detachement_dividende'
  | 'operation_sur_titres'
  | 'baisse_resultats'
  | 'baisse_dividende'
  | 'evenement_publie'
  | 'pression_vendeuse_sans_catalyseur';

export interface ExplicationDecrochage {
  fenetre_debut: string;
  fenetre_fin: string;
  perf_titre_pct: number | null;
  perf_composite_pct: number | null;
  ecart_secteur_pct: number | null;
  facteurs_observes: Array<{
    type: FacteurDecrochageType;
    detail: string;
  }>;
}

export interface SousScoresOpportunite {
  qualiteFinanciere: number | null;
  valorisation: number | null;
  dividendes: number | null;
  resilienceHistorique: number | null;
  liquidite: number | null;
  momentumStabilisation: number | null;
  plafonne_par_confiance: boolean;
}

export interface ActionResilienceRow {
  code: string;
  date_marche: string;
  designation: string;
  secteur: string;
  pays: string | null;
  famille_comptable: FamilleComptable;
  isin: string | null;
  date_introduction: string | null;
  capitalisation: number | null;
  cours_jour: number | null;
  perf_1j_pct: number | null;
  perf_5j_pct: number | null;
  perf_1m_pct: number | null;
  perf_3m_pct: number | null;
  perf_6m_pct: number | null;
  perf_ytd_pct: number | null;
  perf_1a_pct: number | null;
  perf_totale_1a_pct: number | null;
  perf_totale_ytd_pct: number | null;
  drawdown_pct: number | null;
  date_sommet: string | null;
  valeur_sommet: number | null;
  volatilite_ann_pct: number | null;
  beta: number | null;
  force_relative_pct: number | null;
  resistance_jours_baisse_pct: number | null;
  freq_seances_positives_pct: number | null;
  stabilite_volumes: number | null;
  decrochage_relatif_pct: number | null;
  alpha_anormal_pct: number | null;
  decrochage_anormal: boolean;
  explication_decrochage: ExplicationDecrochage;
  fondamentaux: FondamentauxAnalyse;
  dividendes: DividendesAnalyse;
  liquidite: LiquiditeAnalyse;
  score_opportunite: number | null;
  score_confiance: number;
  sous_scores: SousScoresOpportunite;
  categorie: CategorieOpportunite;
  classement_a_rang: number | null;
  classement_b_rang: number | null;
  classement_c_rang: number | null;
  illiquide_flag: boolean;
  anomalies_donnees: string[];
}

export interface SecteurStressRow {
  secteur: string;
  nb_valeurs: number;
  nb_hausses: number;
  nb_baisses: number;
  nb_inchanges: number;
  capitalisation_totale: number;
  poids_marche_pct: number;
  perf_1j_pct: number | null;
  perf_1s_pct: number | null;
  perf_1m_pct: number | null;
  perf_ytd_pct: number | null;
  /** Contribution pondérée au mouvement du marché (poids * perf_1m ou perf_1j), en points de %. */
  contribution_1j_pts: number | null;
  contribution_1m_pts: number | null;
  volume_jour: number;
  valeur_echangee_jour: number;
}

export interface SyntheseResilience {
  date_marche: string | null;
  source_mode: 'table_precalculee' | 'calcul_live';
  nb_valeurs: number;
  nb_decrochages_anormaux: number;
  nb_illiquides: number;
  actions: ActionResilienceRow[];
  secteurs: SecteurStressRow[];
}
