// Veille system types

export type VeilleSource = 'github' | 'twitter' | 'stack_overflow' | 'youtube' | 'rss' | 'linkedin';

export type VeilleCategory =
  | 'bug'
  | 'news'
  | 'solution'
  | 'tutorial'
  | 'competitor'
  | 'regulation'
  | 'market_alert';

export type VeilleAlertType =
  | 'regulatory_change'
  | 'competitor_move'
  | 'technical_vulnerability'
  | 'market_shock'
  | 'systemic_risk';

export type VeilleAlertSeverity = 'high' | 'medium' | 'low';

export type VeilleSentiment = 'positive' | 'neutral' | 'negative';

export type VeilleJobStatus = 'success' | 'partial' | 'failed';

export interface VeilleDigestRow {
  source: VeilleSource;
  category?: VeilleCategory;
  title: string;
  summary?: string;
  url?: string;
  relevance_score?: number;
  sentiment?: VeilleSentiment;
  tags?: string[];
  full_content?: Record<string, any>;
  is_critical?: boolean;
}

export interface VeilleAlert {
  digest_id: number;
  alert_type: VeilleAlertType;
  severity: VeilleAlertSeverity;
  description?: string;
  recommended_action?: string;
}

export interface VeilleJobRun {
  date_marche: string;
  source: VeilleSource;
  status: VeilleJobStatus;
  items_fetched: number;
  items_stored: number;
  errors_count: number;
  error_message?: string;
  duration_ms: number;
  metadata?: Record<string, any>;
}
