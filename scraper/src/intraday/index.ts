/**
 * Intraday Patterns Pipeline Orchestration
 *
 * Main batch command that orchestrates the full PHASE 2-4 pipeline:
 * 1. Load 15m candle snapshots (from brvm_actions_daily)
 * 2. Reconstruct candles (PHASE 2)
 * 3. Detect patterns (PHASE 3A/3B)
 * 4. Aggregate scores (PHASE 4)
 * 5. Upsert results to database
 * 6. Log execution summary
 *
 * Entry point for: npm run intraday:patterns [date]
 */

import { logger } from '../logger.js';
import type { Snapshot } from './reconstruct.js';
import { runFixingDetection, qualifyPatterns } from './orchestrate.js';
import { aggregatePatterns } from './aggregate.js';
import {
  upsertQualifiedPatterns,
  upsertPatternScores,
  loadActiveCodes,
  loadSnapshots,
  loadAvgVolume20d,
} from './repository.js';

export interface IntraDayResult {
  code: string;
  date_marche: string;
  raw_patterns_count: number;
  qualified_patterns_count: number;
  scores_generated: boolean;
  errors: string[];
}

export interface IntraDayBatchResult {
  date_marche: string;
  codes_processed: number;
  total_raw_patterns: number;
  total_qualified_patterns: number;
  codes_with_scores: number;
  errors: string[];
  duration_ms: number;
}

/**
 * Main intraday patterns pipeline orchestration for a single code
 *
 * Implements full PHASE 2-4 pipeline:
 * - PHASE 2: Reconstruct 15m candles from snapshots
 * - PHASE 3A: Detect raw patterns (ATR + consolidation)
 * - PHASE 3B: Qualify patterns (confidence, validation)
 * - PHASE 4: Aggregate into daily scores
 *
 * @param code - Instrument code (e.g., 'PALC')
 * @param dateMarche - Trading date (YYYY-MM-DD)
 * @param snapshots - Array of intraday price snapshots
 * @param engineVersion - Engine version string (default: 'v1.0.0')
 * @returns Pipeline execution result
 */
export async function runIntraDayPatternsForCode(
  code: string,
  dateMarche: string,
  snapshots: Snapshot[],
  engineVersion: string = 'v1.0.0',
): Promise<IntraDayResult> {
  const result: IntraDayResult = {
    code,
    date_marche: dateMarche,
    raw_patterns_count: 0,
    qualified_patterns_count: 0,
    scores_generated: false,
    errors: [],
  };

  try {
    if (snapshots.length < 2) {
      logger.warn({ code, dateMarche }, 'Moins de 2 relevés : aucun signal calculable');
      return result;
    }

    // PHASE 3A — détection adaptée au marché de FIXING.
    // La reconstruction en bougies 15 min a été ABANDONNÉE : le cron capture
    // toutes les 15 min, donc chaque bougie ne contenait qu'un point
    // (open = high = low = close) → amplitude nulle → l'ATR et la consolidation
    // ne mesuraient rien (0 pattern en production). Voir indicators/fixingSignals.ts.
    const avgVolume20d = await loadAvgVolume20d(code, dateMarche);

    logger.info({ code, dateMarche, avgVolume20d }, '[PHASE 3A] Détection (fixing)');
    const rawPatterns = runFixingDetection(
      snapshots.map((s) => ({ close: s.close, volume: s.volume })),
      { code, dateMarche, avgVolume20d, engineVersion },
    );
    result.raw_patterns_count = rawPatterns.length;

    if (rawPatterns.length === 0) {
      logger.info({ code, dateMarche }, 'Aucun signal (titre figé ou volume normal)');
      return result;
    }

    // PHASE 3B: Pattern qualification (confidence, validation)
    logger.info({ code, dateMarche }, `[PHASE 3B] Qualifying patterns`);
    const qualifiedPatterns = qualifyPatterns(rawPatterns);
    result.qualified_patterns_count = qualifiedPatterns.length;

    logger.debug(
      { code, dateMarche, qualified_count: qualifiedPatterns.length },
      `Pattern qualification complete`,
    );

    // Persist qualified patterns to database
    if (qualifiedPatterns.length > 0) {
      logger.info({ code, dateMarche }, `Upserting qualified patterns`);
      await upsertQualifiedPatterns(qualifiedPatterns);
    }

    // PHASE 4: Aggregate scores
    logger.info({ code, dateMarche }, `[PHASE 4] Aggregating pattern scores`);
    const patternScore = aggregatePatterns(qualifiedPatterns, code, dateMarche, engineVersion);

    logger.debug(
      {
        code,
        dateMarche,
        atr_score: patternScore.atr_score,
        consolidation_score: patternScore.consolidation_score,
        advisor_delta: patternScore.advisor_sub_score_delta,
      },
      `Pattern aggregation complete`,
    );

    // Persist score to database
    if (patternScore.patterns_detected_count > 0) {
      logger.info({ code, dateMarche }, `Upserting pattern score`);
      await upsertPatternScores([patternScore]);
      result.scores_generated = true;
    }

    logger.info(
      { code, dateMarche, raw: result.raw_patterns_count, qualified: result.qualified_patterns_count },
      `✓ Intraday patterns pipeline complete`,
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({ code, dateMarche, error: errorMsg }, `Pipeline error`);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Batch orchestration for all active codes on a given date
 *
 * Orchestrates the full PHASE 2-4 pipeline for multiple instruments in sequence.
 * Each code processes independently; failures are logged but do not block others.
 *
 * @param dateMarche - Trading date (YYYY-MM-DD, defaults to today)
 * @param codes - Optional list of specific codes to process (defaults to all active codes)
 * @param engineVersion - Engine version string (default: 'v1.0.0')
 * @returns Batch execution summary
 */
export async function runIntraDayPatternsBatch(
  dateMarche?: string,
  codes?: string[],
  engineVersion: string = 'v1.0.0',
): Promise<IntraDayBatchResult> {
  const startTime = Date.now();
  // slice(0,10) plutôt que split('T')[0] : ce dernier est typé `string | undefined`
  // (noUncheckedIndexedAccess) et propageait l'incertitude dans tout le fichier.
  const date = dateMarche || new Date().toISOString().slice(0, 10);

  logger.info({ date }, `=== Starting intraday patterns batch ===`);

  const batchResult: IntraDayBatchResult = {
    date_marche: date,
    codes_processed: 0,
    total_raw_patterns: 0,
    total_qualified_patterns: 0,
    codes_with_scores: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    // Load list of codes to process
    let codesToProcess = codes;
    if (!codesToProcess) {
      logger.info(`Loading active codes for ${date}`);
      codesToProcess = await loadActiveCodes(date);
    }

    if (!codesToProcess || codesToProcess.length === 0) {
      logger.warn({ date }, `No codes to process`);
      batchResult.duration_ms = Date.now() - startTime;
      return batchResult;
    }

    logger.info({ date, code_count: codesToProcess.length }, `Processing ${codesToProcess.length} codes`);

    // Process each code sequentially
    for (const code of codesToProcess) {
      try {
        logger.info(`Processing ${code}`);

        // Load snapshots for this code
        const snapshots = await loadSnapshots(code, date);

        if (snapshots.length === 0) {
          logger.warn({ code, date }, `No snapshots available, skipping`);
          continue;
        }

        // Run pipeline for this code
        const result = await runIntraDayPatternsForCode(code, date, snapshots, engineVersion);

        batchResult.codes_processed += 1;
        batchResult.total_raw_patterns += result.raw_patterns_count;
        batchResult.total_qualified_patterns += result.qualified_patterns_count;

        if (result.scores_generated) {
          batchResult.codes_with_scores += 1;
        }

        if (result.errors.length > 0) {
          batchResult.errors.push(`${code}: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error({ code, date, error: errorMsg }, `Batch processing error for code`);
        batchResult.errors.push(`${code}: ${errorMsg}`);
      }
    }

    batchResult.duration_ms = Date.now() - startTime;

    // Log summary
    logger.info(
      {
        date,
        codes_processed: batchResult.codes_processed,
        total_raw_patterns: batchResult.total_raw_patterns,
        total_qualified_patterns: batchResult.total_qualified_patterns,
        codes_with_scores: batchResult.codes_with_scores,
        errors: batchResult.errors.length,
        duration_ms: batchResult.duration_ms,
      },
      `=== Intraday patterns batch complete ===`,
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({ date, error: errorMsg }, `Batch initialization error`);
    batchResult.errors.push(`Batch error: ${errorMsg}`);
  }

  batchResult.duration_ms = Date.now() - startTime;
  return batchResult;
}
