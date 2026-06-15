/** Issue normalisée d'un runner instrumenté. */
export interface RunOutcome {
  status?: 'success' | 'partial' | 'failed';
  rows_extracted: number;
  rows_upserted: number;
  metadata?: Record<string, unknown>;
}

/** Enregistrement final inséré dans scraper_runs (hors id/source_id/trigger_type/started_at). */
export interface RunRecord {
  status: 'success' | 'partial' | 'failed';
  finished_at: string;
  duration_ms: number;
  rows_extracted: number;
  rows_upserted: number;
  error_count: number;
  metadata: Record<string, unknown>;
}

export interface BuildRunRecordInput {
  startedAtMs: number;
  finishedAtMs: number;
  outcome?: RunOutcome;
  error?: unknown;
}

/** Calcule l'enregistrement d'un run (pur, testable) à partir du timing et du résultat. */
export function buildRunRecord(input: BuildRunRecordInput): RunRecord {
  const { startedAtMs, finishedAtMs, outcome, error } = input;
  const duration_ms = Math.max(0, finishedAtMs - startedAtMs);
  if (error !== undefined && error !== null) {
    return {
      status: 'failed',
      finished_at: new Date(finishedAtMs).toISOString(),
      duration_ms,
      rows_extracted: 0,
      rows_upserted: 0,
      error_count: 1,
      metadata: {},
    };
  }
  return {
    status: outcome?.status ?? 'success',
    finished_at: new Date(finishedAtMs).toISOString(),
    duration_ms,
    rows_extracted: outcome?.rows_extracted ?? 0,
    rows_upserted: outcome?.rows_upserted ?? 0,
    error_count: 0,
    metadata: outcome?.metadata ?? {},
  };
}
