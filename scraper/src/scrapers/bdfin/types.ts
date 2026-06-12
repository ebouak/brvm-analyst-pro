/**
 * Types pour l'intégration BDFIN (Obscura).
 * Interfaces de haut niveau pour instruments et données de marché.
 */

export interface BdfinInstrument {
  code: string;
  designation: string;
  pays: string;
  secteur: string;
  type: string;
  statut: string;
  isin?: string;
  scraped_at: string;
}

export interface BdfinMarketDataRow {
  code: string;
  designation: string;
  cours_jour: number;
  cours_precedent: number;
  variation_pct: number;
  volume: number;
  nb_transactions: number;
  valeur_echangee: number;
}

export interface BdfinMarketData {
  date_marche: string;
  actions: BdfinMarketDataRow[];
  obligations: BdfinMarketDataRow[];
  summary: {
    valeur_transactions: number;
    capitalisation_actions: number;
    capitalisation_obligations: number;
  };
}

export interface ScrapeBdfinInstrumentsResult {
  status: 'success' | 'failed';
  instruments?: BdfinInstrument[];
  error?: string;
}

export interface ScrapeBdfinMarketResult {
  status: 'success' | 'failed';
  data?: BdfinMarketData;
  error?: string;
}
