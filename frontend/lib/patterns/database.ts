import type { Timeframe, ConfidenceLevel, ValidationStatus, JobStatus, PipelinePhase, IntegrityStatus, IntegrityCheckType, PatternType } from './types.js';

// Pattern engine configuration (versioned rules)
export interface PatternEngineConfig {
  id: number;
  engine_version: string;
  rules_version: string;
  atr_period: number;
  atr_multiplier: number;
  min_snapshots_for_complete: number;
  min_quality_score_for_valid: number;
  consolidation_min_bars: number;
  consolidation_max_body_ratio: number;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

// Reconstructed 15-minute candle (PHASE 2)
export interface IntraDayCandle15m {
  code: string;
  date_marche: string;
  time_start: string;
  time_end: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sample_count: number;
  quality_score: number;
  is_complete: boolean;
  is_synthetic: boolean;
  source: string;
  engine_version: string;
  created_at: string;
  updated_at: string;
}

// Reconstructed 30-minute candle (PHASE 2 aggregated from 15m)
export interface IntraDayCandle30m {
  code: string;
  date_marche: string;
  time_start: string;
  time_end: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sample_count: number;
  quality_score: number;
  is_complete: boolean;
  is_synthetic: boolean;
  source: string;
  engine_version: string;
  created_at: string;
  updated_at: string;
}

// Raw pattern detection result (PHASE 3A)
export interface IntraDayPatternRaw {
  code: string;
  date_marche: string;
  pattern_type: PatternType;
  timeframe: Timeframe;
  candle_start_time: string;
  candle_end_time: string;
  detected_at: string;
  value: number;
  threshold: number;
  is_triggered: boolean;
  metadata: Record<string, unknown> | null;
  engine_version: string;
  rules_version: string;
  created_at: string;
}

// Qualified pattern (PHASE 3B)
export interface IntraDayPattern {
  code: string;
  date_marche: string;
  pattern_type: PatternType;
  timeframe: Timeframe;
  candle_start_time: string;
  candle_end_time: string;
  detected_at: string;
  is_triggered: boolean;
  value: number;
  threshold: number;
  quality_score: number;
  confidence_level: ConfidenceLevel;
  associated_news_count: number;
  associated_news_ids: string[] | null;
  has_fundamental_trigger: boolean;
  validation_status: ValidationStatus;
  explanation_fr: string | null;
  engine_version: string;
  rules_version: string;
  created_at: string;
  updated_at: string;
}

// Aggregated pattern scores (PHASE 4)
export interface PatternScore {
  id: number;
  code: string;
  date_marche: string;
  atr_score: number | null;
  atr_confidence: ConfidenceLevel | null;
  atr_explanation_fr: string | null;
  consolidation_score: number | null;
  consolidation_confidence: ConfidenceLevel | null;
  consolidation_explanation_fr: string | null;
  overall_confidence: ConfidenceLevel;
  combined_pattern_score: number | null;
  patterns_detected_count: number;
  patterns_with_news_count: number;
  advisor_impact_estimate: number | null;
  advisor_sub_score_delta: number | null;
  engine_version: string;
  rules_version: string;
  created_at: string;
  updated_at: string;
}

// Job execution audit trail
export interface IntraDayJobRun {
  id: number;
  date_marche: string;
  phase: PipelinePhase;
  job_name: string;
  status: JobStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  rows_in: number;
  rows_out: number;
  errors_count: number;
  warnings_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Data integrity check result (PHASE 0)
export interface IntraDayIntegrityCheck {
  id: number;
  date_marche: string;
  code: string | null;
  check_type: IntegrityCheckType;
  status: IntegrityStatus;
  metric_name: string | null;
  threshold_value: number | null;
  actual_value: number | null;
  message: string | null;
  created_at: string;
}

// Pipeline error log
export interface PatternError {
  id: number;
  date_marche: string;
  phase: PipelinePhase;
  code: string | null;
  table_name: string;
  error_message: string;
  error_code: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
}
