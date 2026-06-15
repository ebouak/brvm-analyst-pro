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

/** Référence d'une source de scraping (clé naturelle + libellé). */
export interface SourceRef {
  code: string;
  label: string;
}

/** Résultat attendu d'un runner instrumenté : sa valeur métier + les métriques du run. */
export interface MonitoredResult<T> {
  value: T;
  outcome: RunOutcome;
}

/** Abstraction des écritures de monitoring (injectée → testable sans réseau). */
export interface MonitoringClient {
  resolveSourceId(source: SourceRef): Promise<string>;
  insertRun(row: { source_id: string; trigger_type: string; status: 'running' }): Promise<string>;
  finalizeRun(runId: string, record: RunRecord): Promise<void>;
  insertError(runId: string, error: unknown): Promise<void>;
  markSourceSuccess(sourceId: string, at: string): Promise<void>;
}

/**
 * Enrobe l'exécution d'un runner : insère un run `running`, exécute, finalise
 * (success/partial/failed), journalise les erreurs, met à jour la source.
 * Le monitoring ne doit jamais masquer le résultat ni l'erreur du runner :
 * une erreur du runner est relancée après journalisation ; une erreur de
 * monitoring est avalée (loguée par l'adaptateur).
 */
export async function withMonitoring<T>(
  client: MonitoringClient,
  source: SourceRef,
  triggerType: string,
  fn: () => Promise<MonitoredResult<T>>,
): Promise<MonitoredResult<T>> {
  const startedAtMs = Date.now();
  const sourceId = await client.resolveSourceId(source);
  const runId = await client.insertRun({ source_id: sourceId, trigger_type: triggerType, status: 'running' });
  try {
    const result = await fn();
    const record = buildRunRecord({ startedAtMs, finishedAtMs: Date.now(), outcome: result.outcome });
    await client.finalizeRun(runId, record);
    if (record.status !== 'failed') await client.markSourceSuccess(sourceId, record.finished_at);
    return result;
  } catch (error) {
    const record = buildRunRecord({ startedAtMs, finishedAtMs: Date.now(), error });
    await client.insertError(runId, error);
    await client.finalizeRun(runId, record);
    throw error;
  }
}
