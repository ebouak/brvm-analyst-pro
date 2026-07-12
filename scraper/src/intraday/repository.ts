/**
 * Intraday Patterns Repository
 * Handles database persistence for pattern detection pipeline results
 */

import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import type { QualifiedPattern } from './orchestrate.js';
import type { PatternScore } from './aggregate.js';

// NB : upsertRawPatterns (table brvm_intraday_patterns_raw) a été SUPPRIMÉ
// (2026-07-13). La fonction n'était appelée nulle part et la table était
// triplement redondante : `qualifyPatterns` ne filtre rien (la table qualifiée
// contient déjà tout), la vraie donnée brute vit dans brvm_intraday_snapshots
// (recalculable à volonté — cf. `intraday:calibrate`), et le frontend ne la
// lisait pas. Le sens du mouvement (hausse/baisse) est porté par explanation_fr.

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

  // Historique des captures 15 min alimenté par le scraper intraday
  // (brvm_intraday_snapshots : une ligne par code à chaque passage de séance).
  const { data, error } = await client
    .from('brvm_intraday_snapshots')
    .select('captured_at, close, volume')
    .eq('code', code)
    .eq('date_marche', dateMarche)
    .order('captured_at', { ascending: true });

  if (error) {
    logger.error({ error }, `Failed to load snapshots for ${code} on ${dateMarche}`);
    return [];
  }

  const snapshots = (data ?? [])
    .filter((r: { close: number | null }) => r.close != null)
    .map((r: { captured_at: string; close: number; volume: number | null }) => ({
      timestamp: new Date(r.captured_at),
      close: Number(r.close),
      volume: Number(r.volume ?? 0),
    }));

  if (snapshots.length === 0) {
    logger.warn(`No snapshots found for ${code} on ${dateMarche}`);
    return [];
  }

  logger.info(`Loaded ${snapshots.length} snapshots for ${code}`);
  return snapshots;
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

  // brvm_actions_daily a déjà une seule ligne par (code, date_marche) → les codes
  // sont déjà distincts, pas besoin de DISTINCT (méthode inexistante dans
  // supabase-js — c'était la cause du crash « .distinct is not a function »).
  const { data, error } = await client
    .from('brvm_actions_daily')
    .select('code')
    .eq('date_marche', date);

  if (error) {
    logger.error({ error }, `Failed to load active codes for ${date}`);
    return [];
  }

  if (!data || data.length === 0) {
    logger.warn(`No active codes found for ${date}`);
    return [];
  }

  const codes = [...new Set(data.map((row: { code: string }) => row.code).filter(Boolean))];
  logger.info(`Loaded ${codes.length} active codes for ${date}`);
  return codes;
}

/**
 * Moyenne des volumes quotidiens des 20 dernières séances (avant `dateMarche`).
 *
 * Référence du signal `volume_spike` : sans elle, aucun ratio n'est calculable
 * et le signal n'est PAS émis (jamais de division fantaisiste). Renvoie `null`
 * si l'historique est insuffisant.
 */
export async function loadAvgVolume20d(
  code: string,
  dateMarche: string,
): Promise<number | null> {
  const client = getSupabase();

  const { data, error } = await client
    .from('brvm_actions_daily')
    .select('volume')
    .eq('code', code)
    .lt('date_marche', dateMarche) // strictement AVANT la séance analysée
    .order('date_marche', { ascending: false })
    .limit(20);

  if (error) {
    logger.warn({ code, err: error.message }, 'loadAvgVolume20d : lecture échouée');
    return null;
  }

  const volumes = (data ?? [])
    .map((r: { volume: number | null }) => r.volume)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  if (volumes.length === 0) return null;
  return volumes.reduce((a, b) => a + b, 0) / volumes.length;
}
