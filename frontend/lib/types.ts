// Types DB minimaux (alignés sur supabase/migrations/0001_init.sql).
export interface ActionDaily {
  code: string;
  date_marche: string;
  designation: string | null;
  pays: string | null;
  secteur: string | null;
  cours_precedent: number | null;
  cours_jour: number | null;
  variation_pct: number | null;
  volume: number | null;
  nb_transactions: number | null;
  valeur_echangee: number | null;
}

export interface IndiceDaily {
  code: string;
  date_marche: string;
  libelle: string | null;
  valeur: number | null;
  valeur_precedente: number | null;
  variation_pct: number | null;
}

export interface SignalDaily {
  code: string;
  date_marche: string;
  signal: 'BUY' | 'HOLD' | 'SELL';
  score_total: number;
  score_variation?: number | null;
  score_volume?: number | null;
  score_rsi?: number | null;
  bonus_tendance?: number | null;
  penalite_liquidite?: number | null;
  confiance: number | null;
  explication: string | null;
}

export interface MarketEvent {
  id: string;
  event_date: string;
  event_datetime: string | null;
  source: string;
  source_url: string | null;
  source_type: string;
  title: string;
  summary: string | null;
  event_type: string;
  issuer_name: string | null;
  instrument_code: string | null;
  sector: string | null;
  country_code: string | null;
  importance_level: number | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  tags: string[] | null;
}

export type Period = '1S' | '1M' | '3M' | '6M' | '1A' | 'max';

export const PERIOD_DAYS: Record<Period, number> = {
  '1S': 7, '1M': 31, '3M': 93, '6M': 186, '1A': 372, max: 100000,
};

export interface ObligationDaily {
  code: string;
  date_marche: string;
  designation: string | null;
  emetteur: string | null;
  taux_pct: number | null;
  maturite: string | null;
  cours_precedent: number | null;
  cours_jour: number | null;
  volume: number | null;
  valeur_echangee: number | null;
}

export interface Dividend {
  id: string;
  code: string;
  exercice: number | null;
  ex_date: string | null;
  payment_date: string | null;
  montant: number;
  devise: string;
}
