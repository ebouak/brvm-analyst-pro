/** Type d'un événement de marché normalisé (aligné sur market_events). */
export type EventSourceType =
  | 'communique'
  | 'avis'
  | 'info_permanente'
  | 'rapport'
  | 'bulletin'
  | 'publication';

export type EventType =
  | 'dividende'
  | 'resultats'
  | 'assemblee'
  | 'admission'
  | 'suspension'
  | 'autre';

export interface MarketEvent {
  event_date: string; // YYYY-MM-DD
  event_datetime: string | null;
  source: string;
  source_url: string | null;
  source_type: EventSourceType;
  title: string;
  summary: string | null;
  event_type: EventType;
  issuer_name: string | null;
  instrument_code: string | null;
  sector: string | null;
  country_code: string | null;
  importance_level: number | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  tags: string[] | null;
  /** Titres liés (codes) pour le pivot market_event_instruments. */
  related_codes: string[];
}
