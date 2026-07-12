/**
 * Orchestration module for PHASE 3A/3B pattern detection pipeline
 * Combines ATR detection, consolidation detection, and qualification logic
 */

import { detectATRExtremes } from './indicators/atr.js';
import { detectConsolidationPatterns } from './indicators/consolidation.js';
import { detectFixingSignals, type IntradaySample } from './indicators/fixingSignals.js';
import type { Candle15m } from './reconstruct.js';

/**
 * Types de signaux.
 *
 * `atr_extreme` / `bullish_consolidation` sont CONSERVÉS pour les lignes déjà
 * en base, mais ne sont plus produits : sur un marché de fixing comme la BRVM,
 * chaque bougie de 15 min ne contient qu'un point (open = high = low = close),
 * donc l'amplitude vraie est nulle et ces deux détecteurs ne peuvent rien
 * mesurer (diagnostic 2026-07-12 — 0 pattern en production depuis la mise en
 * service du cron). Voir indicators/fixingSignals.ts.
 */
export type PatternType =
  | 'intraday_momentum'
  | 'volume_spike'
  | 'atr_extreme' // hérité — plus produit
  | 'bullish_consolidation'; // hérité — plus produit

export interface RawPattern {
  code: string;
  date_marche: string;
  pattern_type: PatternType;
  timeframe: '15m' | '30m' | 'session';
  candle_start_time: Date;
  candle_end_time: Date;
  /** MAGNITUDE (toujours ≥ 0) — la qualification calcule value/threshold. */
  value: number;
  threshold: number;
  is_triggered: boolean;
  engine_version: string;
  rules_version: string;
  /**
   * Sens du mouvement, quand il en a un (`intraday_momentum`). `value` ne porte
   * que la magnitude : sans ce champ, une baisse de 5 % serait indiscernable
   * d'une hausse de 5 % dans l'explication montrée à l'utilisateur.
   */
  direction?: 'up' | 'down';
}

export interface QualifiedPattern extends RawPattern {
  quality_score: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  validation_status: 'VALID' | 'QUESTIONABLE' | 'INVALID';
  explanation_fr: string;
}

/**
 * PHASE 3A: Run raw pattern detection (ATR + consolidation)
 *
 * Takes reconstructed 15-minute candles and applies two detection strategies:
 * 1. ATR Extreme: Detects volatility spikes using Average True Range
 * 2. Bullish Consolidation: Detects tight trading ranges (squeeze setups)
 *
 * @param candles - Array of reconstructed 15-minute candles
 * @param code - Instrument code (e.g., 'PALC')
 * @param dateMarche - Trading date in YYYY-MM-DD format
 * @param engineVersion - Engine version string (e.g., 'v1.0.0')
 * @param rulesVersion - Rules version (default: 'r1.0.0')
 * @returns Array of raw pattern detections
 */
export function runPhase3A(
  candles: Candle15m[],
  code: string,
  dateMarche: string,
  engineVersion: string,
  rulesVersion: string = 'r1.0.0',
): RawPattern[] {
  const patterns: RawPattern[] = [];

  if (candles.length === 0) {
    return patterns;
  }

  // === ATR Detection (PHASE 3A - Part 1) ===
  // Detect extreme volatility moves using Average True Range
  const atrResults = detectATRExtremes(
    candles.map((c) => ({ close: c.close, high: c.high, low: c.low })),
    14, // ATR period
    3.0, // Multiplier threshold
  );

  for (let i = 0; i < atrResults.length; i++) {
    const atrResult = atrResults[i];
    if (atrResult && atrResult.isExtreme) {
      const candle = candles[i];
      if (candle) {
        patterns.push({
          code,
          date_marche: dateMarche,
          pattern_type: 'atr_extreme',
          timeframe: '15m',
          candle_start_time: candle.time_start,
          candle_end_time: candle.time_end,
          value: atrResult.changeAmount,
          threshold: atrResult.atr * 3.0,
          is_triggered: true,
          engine_version: engineVersion,
          rules_version: rulesVersion,
        });
      }
    }
  }

  // === Consolidation Detection (PHASE 3A - Part 2) ===
  // Detect tight trading ranges (consolidation patterns)
  const consolidationPatterns = detectConsolidationPatterns(
    candles.map((c) => ({ open: c.open, close: c.close, high: c.high, low: c.low })),
    3, // Minimum bars
    0.3, // Max body ratio
  );

  for (const consPattern of consolidationPatterns) {
    const endIdx = consPattern.startIndex + consPattern.length - 1;
    const candle = candles[endIdx];
    if (candle && consPattern.confidence >= 0.5) {
      // Only include if confidence meets threshold
      patterns.push({
        code,
        date_marche: dateMarche,
        pattern_type: 'bullish_consolidation',
        timeframe: '15m',
        candle_start_time: candles[consPattern.startIndex]!.time_start,
        candle_end_time: candle.time_end,
        value: consPattern.confidence,
        threshold: 0.7, // Min confidence for valid consolidation
        is_triggered: consPattern.confidence >= 0.7,
        engine_version: engineVersion,
        rules_version: rulesVersion,
      });
    }
  }

  return patterns;
}

/**
 * PHASE 3A (marché de FIXING) — détection réellement applicable à la BRVM.
 *
 * Remplace `runPhase3A` (ATR + consolidation), qui ne pouvait rien détecter ici :
 * avec une capture toutes les 15 min sur un marché de fixing, chaque bougie ne
 * contient qu'un point (open = high = low = close) → amplitude vraie nulle.
 *
 * Travaille directement sur les relevés de séance (pas sur des bougies) :
 *  - `intraday_momentum` : direction depuis l'ouverture (seuil 3 %) ;
 *  - `volume_spike`      : volume de séance vs moyenne 20 j (seuil 2×).
 *
 * IMPORTANT : le momentum est SIGNÉ (une baisse est un signal). Comme la
 * qualification calcule `value / threshold`, on stocke ici la **magnitude**
 * (valeur absolue) — sinon une baisse donnerait un ratio négatif et serait
 * qualifiée « INVALID ». Le sens est conservé dans l'explication en français.
 */
export function runFixingDetection(
  samples: IntradaySample[],
  ctx: {
    code: string;
    dateMarche: string;
    avgVolume20d: number | null;
    engineVersion: string;
    rulesVersion?: string;
  },
): RawPattern[] {
  const { code, dateMarche, avgVolume20d, engineVersion, rulesVersion = 'r2.0.0' } = ctx;
  if (samples.length < 2) return [];

  // Bornes de la séance (pas de bougie : le signal porte sur la journée entière).
  const start = new Date(`${dateMarche}T00:00:00Z`);
  const end = new Date(`${dateMarche}T23:59:59Z`);

  return detectFixingSignals(samples, { avgVolume20d }).map((s) => ({
    code,
    date_marche: dateMarche,
    pattern_type: s.type as PatternType,
    timeframe: 'session' as const,
    candle_start_time: start,
    candle_end_time: end,
    // Magnitude : la qualification fait value/threshold — un momentum négatif
    // donnerait un ratio négatif et serait qualifié « INVALID ».
    value: Math.abs(s.value),
    threshold: s.threshold,
    is_triggered: s.triggered,
    engine_version: engineVersion,
    rules_version: rulesVersion,
    // Le sens est conservé à part (cf. RawPattern.direction).
    ...(s.type === 'intraday_momentum'
      ? { direction: (s.value >= 0 ? 'up' : 'down') as 'up' | 'down' }
      : {}),
  }));
}

/**
 * PHASE 3B: Qualify patterns (apply confidence rules, validate)
 *
 * Takes raw patterns from PHASE 3A and applies qualification logic:
 * - Calculates quality score as (value / threshold)
 * - Assigns confidence level based on quality score
 * - Determines validation status based on confidence and trigger state
 * - Generates French-language explanation
 *
 * Confidence levels:
 * - HIGH: quality > 1.2 (pattern significantly exceeds threshold)
 * - MEDIUM: quality > 0.8 (pattern moderately exceeds threshold)
 * - LOW: quality <= 0.8 (pattern weakly signals)
 *
 * Validation status:
 * - VALID: HIGH confidence + triggered = strong signal
 * - QUESTIONABLE: MEDIUM confidence + triggered = moderate signal
 * - INVALID: anything else = weak or not triggered
 *
 * @param rawPatterns - Array of raw patterns from PHASE 3A
 * @param minQualityScore - Minimum quality score to qualify (default: 0.5)
 * @returns Array of qualified patterns with confidence levels and validation
 */
export function qualifyPatterns(
  rawPatterns: RawPattern[],
  minQualityScore: number = 0.5,
): QualifiedPattern[] {
  return rawPatterns.map((raw) => {
    // Calculate quality as ratio of value to threshold
    // Do NOT clamp for confidence calculation (value can exceed threshold)
    const rawQuality = raw.threshold > 0 ? raw.value / raw.threshold : 0;

    // Determine confidence level based on raw ratio (not clamped)
    let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    if (rawQuality > 1.2) {
      confidenceLevel = 'HIGH';
    } else if (rawQuality > 0.8) {
      confidenceLevel = 'MEDIUM';
    } else {
      confidenceLevel = 'LOW';
    }

    // Quality score for storage: clamp to [0, 1] for database normalization
    const quality = Math.min(1.0, Math.max(0.0, rawQuality));

    // Determine validation status
    // Pattern is VALID if it has HIGH confidence AND is triggered
    // Pattern is QUESTIONABLE if it has MEDIUM confidence AND is triggered
    // Pattern is INVALID otherwise
    let validationStatus: 'VALID' | 'QUESTIONABLE' | 'INVALID';
    if (confidenceLevel === 'HIGH' && raw.is_triggered) {
      validationStatus = 'VALID';
    } else if (confidenceLevel === 'MEDIUM' && raw.is_triggered) {
      validationStatus = 'QUESTIONABLE';
    } else {
      validationStatus = 'INVALID';
    }

    // Explication française — DÉRIVÉE des mesures, jamais générique : elle doit
    // dire ce qui a été mesuré et de combien (le sens du mouvement est ici, car
    // `value` ne porte que la magnitude — cf. runFixingDetection).
    const statusFr = {
      VALID: 'signal net',
      QUESTIONABLE: 'signal modéré',
      INVALID: 'signal faible',
    }[validationStatus];

    let explanation_fr: string;
    switch (raw.pattern_type) {
      case 'intraday_momentum': {
        const sens = raw.direction === 'down' ? 'Baisse' : 'Hausse';
        explanation_fr =
          `${sens} de ${raw.value.toFixed(2)} % depuis l'ouverture ` +
          `(seuil ${raw.threshold} %) — ${statusFr}.`;
        break;
      }
      case 'volume_spike':
        explanation_fr =
          `Volume de séance ${raw.value.toFixed(1)}× la moyenne 20 séances ` +
          `(seuil ${raw.threshold}×) — ${statusFr}.`;
        break;
      // Types hérités : plus produits, mais des lignes existent en base.
      case 'atr_extreme':
        explanation_fr = `Volatilité extrême (ATR) — ${statusFr}.`;
        break;
      default:
        explanation_fr = `Consolidation haussière — ${statusFr}.`;
    }

    return {
      ...raw,
      quality_score: quality,
      confidence_level: confidenceLevel,
      validation_status: validationStatus,
      explanation_fr,
    };
  });
}
