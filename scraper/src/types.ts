/**
 * Types partagés du scraper BDFIN BRVM.
 * Ces formes correspondent aux colonnes des tables Supabase
 * (cf. supabase/migrations/0001_init.sql).
 */

/** Date de marché au format ISO court YYYY-MM-DD. */
export type MarketDate = string;

/** Ligne d'action telle qu'extraite puis normalisée. */
export interface ActionRow {
  /** Code BRVM du titre, ex: "SNTS", "SGBC". */
  code: string;
  /** Désignation / raison sociale. */
  designation: string;
  /** Pays UEMOA (CI, SN, BJ, ...). Peut être null si absent du tableau. */
  pays: string | null;
  /** Secteur d'activité. Peut être null. */
  secteur: string | null;
  /** Cours de clôture de la veille. */
  cours_precedent: number | null;
  /** Cours du jour. */
  cours_jour: number | null;
  /** Variation en pourcentage (déjà en %, ex: -2.5). */
  variation_pct: number | null;
  /** Volume de titres échangés. */
  volume: number | null;
  /** Nombre de transactions. */
  nb_transactions: number | null;
  /** Valeur échangée (FCFA). */
  valeur_echangee: number | null;
}

/** Ligne d'obligation extraite puis normalisée. */
export interface ObligationRow {
  /** Code ISIN ou code BRVM de l'obligation. */
  code: string;
  designation: string;
  emetteur: string | null;
  /** Taux nominal du coupon en %, ex: 6.25. */
  taux_pct: number | null;
  /** Maturité (date ISO) si disponible. */
  maturite: MarketDate | null;
  cours_precedent: number | null;
  cours_jour: number | null;
  volume: number | null;
  valeur_echangee: number | null;
}

/** Valeur d'un indice. */
export interface IndiceRow {
  /** Code interne: "BRVM30" | "BRVMC" (composite) | autre. */
  code: string;
  /** Libellé affiché. */
  libelle: string;
  valeur: number | null;
  valeur_precedente: number | null;
  variation_pct: number | null;
}

/** Résultat brut d'un scrape d'une page marché. */
export interface MarketSnapshot {
  date_marche: MarketDate;
  actions: ActionRow[];
  obligations: ObligationRow[];
  indices: IndiceRow[];
  /** Hash SHA-256 du HTML source — détecte les changements de markup / doublons. */
  hash_source: string;
  /** true si les données proviennent des fixtures mock. */
  is_mock: boolean;
}

/** Statut d'un run de scraping (colonne scrape_runs.status). */
export type ScrapeStatus = 'success' | 'partial' | 'failed' | 'mock';

/** Enregistrement journalisé dans scrape_runs. */
export interface ScrapeRunRecord {
  source: string;
  started_at: string;
  finished_at: string | null;
  status: ScrapeStatus;
  nb_actions: number;
  nb_obligations: number;
  nb_indices: number;
  message_erreur: string | null;
  hash_source: string | null;
  date_marche: MarketDate | null;
}

/** Résultat d'une validation qualité. */
export interface QualityIssue {
  level: 'warn' | 'error';
  scope: 'action' | 'obligation' | 'indice';
  code: string;
  field: string;
  message: string;
}
