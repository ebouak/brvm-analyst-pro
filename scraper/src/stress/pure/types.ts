/**
 * Contrats purs du Historical Crisis Engine (Phase 1 — WESTBOURSE Stress Monitor).
 * Zéro dépendance I/O, utilisable côté scraper et côté frontend.
 */

export interface PointIndice {
  date_marche: string; // YYYY-MM-DD
  valeur: number;
  variation_pct?: number | null;
  volume?: number | null;
  valeur_echangee?: number | null;
  capitalisation?: number | null;
  source?: string | null;
  qualite?: string | null;
}

export interface PointDrawdown {
  date_marche: string;
  valeur: number;
  sommet_precedent: number;
  date_sommet_precedent: string;
  /** Pourcentage négatif ou nul, ex: -18.35 */
  drawdown_pct: number;
}

export type NiveauCrise =
  | 'correction_moderee'
  | 'correction_significative'
  | 'correction_severe'
  | 'marche_baissier'
  | 'crise_majeure'
  | 'crise_extreme';

/** Seuils officiels du cahier des charges (en % négatif). */
export const SEUILS_CRISES = [-5, -10, -15, -20, -30, -40] as const;

export const LIBELLES_NIVEAUX: Record<NiveauCrise, string> = {
  correction_moderee: 'Correction modérée (−5 %)',
  correction_significative: 'Correction significative (−10 %)',
  correction_severe: 'Correction sévère (−15 %)',
  marche_baissier: 'Marché baissier (−20 %)',
  crise_majeure: 'Crise majeure (−30 %)',
  crise_extreme: 'Crise extrême (−40 %)',
};

/**
 * Dates officielles de création des indices BRVM.
 * Règle impérative : ne jamais reconstituer ni accepter de valeur avant cette date.
 */
export const DATES_CREATION_INDICES: Record<string, string> = {
  BRVMC: '1998-09-16',
  BRVM30: '2023-01-01',
  BRVMPRES: '2023-01-01',
  BRVMPRIN: '2023-01-01',
  BRVMCBASE: '2023-01-01',
  BRVMCDISC: '2023-01-01',
  BRVMENER: '2023-01-01',
  BRVMINDU: '2023-01-01',
  BRVMFINS: '2023-01-01',
  BRVMSPUB: '2023-01-01',
  BRVMTELE: '2023-01-01',
};

export interface ConfigDetection {
  /** Seuil déclencheur en % négatif (ex: -10). */
  seuilDeclenchementPct: number;
  /** Seuil de récupération en % (défaut 0 = retour au sommet précédent). */
  seuilRecuperationPct?: number;
  /** Nombre de séances consécutives >= seuilRecuperationPct pour clore l'épisode (défaut 5). */
  joursConfirmationReprise?: number;
  /** Hausse minimale (en %) depuis un creux local pour compter un rebond intermédiaire (défaut 3). */
  seuilRebondIntermediairePct?: number;
  /** Plafond de points conservés dans trajectoire_base100 (défaut 180). */
  maxPointsTrajectoire?: number;
}

export type PhaseTrajectoire = 'baisse' | 'creux' | 'reprise' | 'recupere';

export interface PointTrajectoireBase100 {
  jour_seance: number;
  date: string;
  base100: number;
  drawdown_pct: number;
  phase: PhaseTrajectoire;
}

export interface VariablesMarcheEpisode {
  volatilite_moyenne?: number | null;
  volatilite_max?: number | null;
  pct_titres_baisse_moyen?: number | null;
  volume_relatif_moyen?: number | null;
  perf_banques_pct?: number | null;
  concentration_sectorielle?: number | null;
}

export interface ContexteMacroEpisode {
  taux_bceao_debut_pct?: number | null;
  taux_bceao_fin_pct?: number | null;
  pib_uemoa_moyen_pct?: number | null;
  inflation_uemoa_moyenne_pct?: number | null;
  observations: Array<{
    indicateur: string;
    zone: string;
    date_valeur: string;
    valeur: number;
    unite: string;
    source: string;
  }>;
}

export interface ContexteEntreprisesEpisode {
  nb_evenements: number;
  par_type: Record<string, number>;
  faits_notables: Array<{
    date: string;
    code: string | null;
    type: string;
    titre: string;
    source: string;
  }>;
}

export interface PoidsSimilarite {
  euclidienne: number;
  correlation: number;
  formeDrawdown: number;
  variablesMarche: number;
}

export interface ScoreSimilarite {
  score: number;
  couverture_variables_pct: number;
  composantes: {
    euclidienne: number | null;
    correlation: number | null;
    formeDrawdown: number | null;
    variablesMarche: number | null;
  };
  poids_effectifs: PoidsSimilarite;
  avertissement: string;
}

export interface EpisodeCrise {
  indice_code: string;
  seuil_pct: number;
  niveau: NiveauCrise;
  libelle: string;
  date_sommet: string;
  valeur_sommet: number;
  date_debut_correction: string;
  date_creux: string;
  valeur_creux: number;
  perte_max_pct: number;
  nb_seances_baisse: number;
  duree_calendaire_baisse: number;
  nb_rebonds_intermediaires: number;
  amplitude_max_rebond_pct: number | null;
  date_recuperation: string | null;
  nb_seances_rebond: number | null;
  duree_totale_recuperation_jours: number | null;
  perf_cumulee_recuperation_pct: number | null;
  statut: 'en_cours' | 'termine';
  rebond_1m_pct: number | null;
  rebond_3m_pct: number | null;
  rebond_6m_pct: number | null;
  rebond_12m_pct: number | null;
  rebond_24m_pct: number | null;
  similarite_actuelle?: number | null;
  similarite_details?: ScoreSimilarite | null;
  contexte_marche?: VariablesMarcheEpisode;
  contexte_macro?: ContexteMacroEpisode;
  contexte_entreprises?: ContexteEntreprisesEpisode;
  trajectoire_base100: PointTrajectoireBase100[];
}

export interface AnomalieQualite {
  type: 'doublon_date' | 'valeur_invalide' | 'date_pre_creation' | 'variation_excessive' | 'trou_cotation';
  date_marche: string;
  detail: string;
}

export interface CouvertureAnnuelle {
  annee: string;
  seances: number;
  jours_ouvres_theoriques: number;
  couverture_pct: number;
}

export interface RapportCouverture {
  indice_code: string;
  debut_date: string | null;
  fin_date: string | null;
  nb_seances_disponibles: number;
  nb_jours_ouvres_theoriques: number;
  nb_seances_manquantes: number;
  couverture_pct: number;
  annees_exploitables: CouvertureAnnuelle[];
  trous_majeurs: Array<{ debut: string; fin: string; jours_ouvres_manquants: number }>;
}
