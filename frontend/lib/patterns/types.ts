// Enums & Type Constants for intraday pattern detection
// These are the source of truth for all pattern-related type validation

// Job lifecycle states
export const JOB_STATUS = {
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

// Pipeline execution phases
export const PIPELINE_PHASE = {
  INTEGRITY_CHECK: 'integrity_check',
  RECONSTRUCT: 'reconstruct',
  DETECT_RAW: 'detect_raw',
  QUALIFY: 'qualify',
  AGGREGATE: 'aggregate',
} as const;
export type PipelinePhase = typeof PIPELINE_PHASE[keyof typeof PIPELINE_PHASE];

// Pattern detection types
export const PATTERN_TYPE = {
  ATR_EXTREME: 'atr_extreme',
  BULLISH_CONSOLIDATION: 'bullish_consolidation',
} as const;
export type PatternType = typeof PATTERN_TYPE[keyof typeof PATTERN_TYPE];

// Timeframes for candle reconstruction
export const TIMEFRAME = {
  TF_15M: '15m',
  TF_30M: '30m',
} as const;
export type Timeframe = typeof TIMEFRAME[keyof typeof TIMEFRAME];

// Confidence levels from ATR & consolidation indicators
export const CONFIDENCE_LEVEL = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVEL[keyof typeof CONFIDENCE_LEVEL];

// Pattern validation status (PHASE 3B)
export const VALIDATION_STATUS = {
  VALID: 'VALID',
  QUESTIONABLE: 'QUESTIONABLE',
  INVALID: 'INVALID',
} as const;
export type ValidationStatus = typeof VALIDATION_STATUS[keyof typeof VALIDATION_STATUS];

// Data quality checks (PHASE 0)
export const INTEGRITY_STATUS = {
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
} as const;
export type IntegrityStatus = typeof INTEGRITY_STATUS[keyof typeof INTEGRITY_STATUS];

// Types of integrity checks
export const INTEGRITY_CHECK_TYPE = {
  SNAPSHOT_COUNT: 'snapshot_count',
  TIMESTAMP_CONTINUITY: 'timestamp_continuity',
  MISSING_FIELDS: 'missing_fields',
  VOLUME_PLAUSIBILITY: 'volume_plausibility',
} as const;
export type IntegrityCheckType = typeof INTEGRITY_CHECK_TYPE[keyof typeof INTEGRITY_CHECK_TYPE];
