import { logger } from '../logger.js';
import { runVeilleDigest } from '../veille/orchestrator.js';

export interface VeilleRunResult {
  status: 'success' | 'partial' | 'failed' | 'mock';
  date_marche: string;
  digests_count: number;
  alerts_count: number;
  duration_ms: number;
}

/**
 * Runner for BRVM Veille intelligent monitoring system
 * Orchestrates all sources: GitHub, Twitter, Stack Overflow, YouTube, RSS, LinkedIn
 */
export async function runVeille(options: {
  date?: string;
  mock?: boolean;
}): Promise<VeilleRunResult> {
  const startTime = Date.now();

  try {
    const dateMarche = options.date
      ? new Date(options.date)
      : new Date();

    const dateStr = dateMarche.toISOString().slice(0, 10);

    logger.info(
      { date: dateStr, mock: options.mock },
      'Starting BRVM Veille digest run'
    );

    // Run veille orchestrator
    await runVeilleDigest(dateMarche, options.mock);

    const duration = Date.now() - startTime;

    logger.info(
      { duration, date: dateStr },
      'BRVM Veille digest completed'
    );

    return {
      status: options.mock ? 'mock' : 'success',
      date_marche: dateStr,
      digests_count: 0, // Updated by repository after upsert
      alerts_count: 0, // Updated by repository after creation
      duration_ms: duration,
    };
  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      { err, duration },
      'BRVM Veille digest failed'
    );

    return {
      status: 'failed',
      date_marche: new Date().toISOString().slice(0, 10),
      digests_count: 0,
      alerts_count: 0,
      duration_ms: duration,
    };
  }
}
