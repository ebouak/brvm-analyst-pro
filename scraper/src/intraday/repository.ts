/**
 * Intraday Patterns Repository
 * Handles database persistence for pattern detection pipeline results
 */

import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import type { RawPattern, QualifiedPattern } from './orchestrate.js';
import type { PatternScore } from './aggregate.js';

/**
 * Upsert raw patterns (PHASE 3A results) into database
 *
 * Raw patterns are detections before qualification. They contain basic pattern
 * information: type, trigger status, and value/threshold comparison.
 *
 * @param patterns - Array of raw patterns from PHASE 3A
 * @returns Number of patterns inserted
 */
export async function upsertRawPatterns(patterns: RawPattern[]): Promise<number> {
  if (patterns.length === 0) return 0;

  const cfg = getConfig();
  if (cfg.DRY_RUN) {
    logger.info(`[DRY_RUN] Would insert ${patterns.length} raw patterns`);
    return patterns.length;
  }

  const client = getSupabase();

  const records = patterns.map((p) => ({
    code: p.code,
    date_marche: p.date_marche,
    pattern_type: p.pattern_type,
    timeframe: p.timeframe,
    candle_start_time: p.candle_start_time.toISOString(),
    candle_end_time: p.candle_end_time.toISOString(),
    detected_at: new Date().toISOString(),
    value: p.value,
    threshold: p.threshold,
    is_triggered: p.is_triggered,
    metadata: null,
    engine_version: p.engine_version,
    rules_version: p.rules_version,
  }));

  const { data, error, count } = await client
    .from('brvm_intraday_patterns_raw')
    .upsert(records, {
      onConflict: 'code,date_marche,pattern_type,timeframe,candle_start_time,engine_version',
    })
    .select('*', { count: 'exact' });

  if (error) {
    logger.error({ error }, `Failed to upsert raw patterns`);
    throw error;
  }

  const insertedCount = data?.length || count || 0;
  logger.info(`Upserted ${insertedCount} raw patterns`);
  return insertedCount;
}

/**
 * Upsert qualified patterns (PHASE 3B results) into database
 *
 * @param patterns - Array of qualified patterns
 * @returns Number of patterns inserted
 */
export async function upsertQualifiedPatterns(patterns: QualifiedPattern[]): Promise<number> {
  if (patterns.length === 0) return 0;

  const cfg = getConfig();
  if (cfg.DRY_RUN) {
    logger.info(`[DRY_RUN] Would insert ${patterns.length} qualified patterns`);
    return patterns.length;
  }

  const client = getSupabase();

  const records = patterns.map((p) => ({
    code: p.code,
    date_marche: p.date_marche,
    pattern_type: p.pattern_type,
    timeframe: p.timeframe,
    candle_start_time: p.candle_start_time.toISOString(),
    candle_end_time: p.candle_end_time.toISOString(),
    detected_at: p.candle_end_time.toISOString(),
    is_triggered: p.is_triggered,
    value: p.value,
    threshold: p.threshold,
    quality_score: p.quality_score,
    confidence_level: p.confidence_level,
    validation_status: p.validation_status,
    explanation_fr: p.explanation_fr,
    engine_version: p.engine_version,
    rules_version: p.rules_version,
  }));

  const { data, error, count } = await client
    .from('brvm_intraday_patterns')
    .upsert(records, {
      onConflict: 'code,date_marche,pattern_type,timeframe,candle_start_time,engine_version',
    })
    .select('*', { count: 'exact' });

  if (error) {
    logger.error({ error }, `Failed to upsert qualified patterns`);
    throw error;
  }

  const insertedCount = data?.length || count || 0;
  logger.info(`Upserted ${insertedCount} qualified patterns`);
  return insertedCount;
}

/**
 * Upsert pattern scores (PHASE 4 results) into database
 *
 * @param scores - Array of pattern scores
 * @returns Number of scores inserted
 */
export async function upsertPatternScores(scores: PatternScore[]): Promise<number> {
  if (scores.length === 0) return 0;

  const cfg = getConfig();
  if (cfg.DRY_RUN) {
    logger.info(`[DRY_RUN] Would insert ${scores.length} pattern scores`);
    return scores.length;
  }

  const client = getSupabase();

  const records = scores.map((s) => ({
    code: s.code,
    date_marche: s.date_marche,
    atr_score: s.atr_score,
    atr_confidence: s.atr_confidence,
    consolidation_score: s.consolidation_score,
    consolidation_confidence: s.consolidation_confidence,
    overall_confidence: s.overall_confidence,
    combined_pattern_score: s.combined_pattern_score,
    patterns_detected_count: s.patterns_detected_count,
    advisor_sub_score_delta: s.advisor_sub_score_delta,
    engine_version: s.engine_version,
    rules_version: 'r1.0.0', // Default rules version
  }));

  const { data, error, count } = await client
    .from('brvm_pattern_scores')
    .upsert(records, {
      onConflict: 'code,date_marche',
    })
    .select('*', { count: 'exact' });

  if (error) {
    logger.error({ error }, `Failed to upsert pattern scores`);
    throw error;
  }

  const insertedCount = data?.length || count || 0;
  logger.info(`Upserted ${insertedCount} pattern scores`);
  return insertedCount;
}

/**
 * Load 15m candle snapshots for a given code and date
 *
 * Snapshots are loaded from brvm_actions_daily where they were stored
 * during the intraday scrape run.
 *
 * @param code - Instrument code
 * @param dateMarche - Trading date
 * @returns Array of snapshots with timestamp and close price
 */
export async function loadSnapshots(
  code: string,
  dateMarche: string,
): Promise<Array<{ timestamp: Date; close: number; volume: number }>> {
  const client = getSupabase();

  // Query brvm_actions_daily for the given code and date
  // Note: brvm_actions_daily contains aggregated daily data, but may have
  // intraday snapshot history in metadata or related tables.
  // For now, return empty array as placeholder (to be implemented with full snapshot schema)
  const { data, error } = await client
    .from('brvm_actions_daily')
    .select('*')
    .eq('code', code)
    .eq('date_marche', dateMarche)
    .limit(1);

  if (error) {
    logger.error({ error }, `Failed to load snapshots for ${code} on ${dateMarche}`);
    return [];
  }

  // TODO: Parse snapshot data from response when schema is finalized
  if (!data || data.length === 0) {
    logger.warn(`No snapshots found for ${code} on ${dateMarche}`);
    return [];
  }

  logger.info(`Loaded ${data.length} snapshots for ${code}`);
  return [];
}

/**
 * Load list of active instrument codes for a given date
 *
 * @param dateMarche - Trading date (optional, defaults to today)
 * @returns Array of active instrument codes
 */
export async function loadActiveCodes(dateMarche?: string): Promise<string[]> {
  const client = getSupabase();

  // Query instruments that have trading activity on the given date
  const date = dateMarche || new Date().toISOString().split('T')[0];

  const { data, error } = await client
    .from('brvm_actions_daily')
    .select('code')
    .eq('date_marche', date)
    .distinct();

  if (error) {
    logger.error({ error }, `Failed to load active codes for ${date}`);
    return [];
  }

  if (!data || data.length === 0) {
    logger.warn(`No active codes found for ${date}`);
    return [];
  }

  const codes = data.map((row: any) => row.code).filter(Boolean);
  logger.info(`Loaded ${codes.length} active codes for ${date}`);
  return codes;
}
