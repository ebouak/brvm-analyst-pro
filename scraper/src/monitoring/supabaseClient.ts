import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import type { MonitoringClient, RunRecord, SourceRef } from './recordRun.js';

/** Adaptateur MonitoringClient basé sur le client service-role du scraper. */
export function createSupabaseMonitoringClient(): MonitoringClient {
  const sb = getSupabase();
  return {
    async resolveSourceId(source: SourceRef): Promise<string> {
      // Upsert idempotent par `code` ; renvoie l'id.
      const { data, error } = await sb
        .from('scraper_sources')
        .upsert({ code: source.code, label: source.label }, { onConflict: 'code' })
        .select('id')
        .single();
      if (error) throw new Error(`resolveSourceId: ${error.message}`);
      return data.id as string;
    },
    async insertRun(row): Promise<string> {
      const { data, error } = await sb.from('scraper_runs').insert(row).select('id').single();
      if (error) throw new Error(`insertRun: ${error.message}`);
      return data.id as string;
    },
    async finalizeRun(runId: string, record: RunRecord): Promise<void> {
      const { error } = await sb
        .from('scraper_runs')
        .update({
          status: record.status,
          finished_at: record.finished_at,
          duration_ms: record.duration_ms,
          rows_extracted: record.rows_extracted,
          rows_upserted: record.rows_upserted,
          error_count: record.error_count,
          metadata: record.metadata,
        })
        .eq('id', runId);
      if (error) logger.error({ err: error.message }, 'finalizeRun: échec MAJ scraper_runs');
    },
    async insertError(runId: string, err: unknown): Promise<void> {
      const e = err as Error;
      const { error } = await sb.from('scraper_errors').insert({
        run_id: runId,
        error_type: e?.name ?? 'Error',
        error_message: e?.message ?? String(err),
        stack_excerpt: e?.stack ? e.stack.split('\n').slice(0, 6).join('\n') : null,
      });
      if (error) logger.error({ err: error.message }, 'insertError: échec écriture scraper_errors');
    },
    async markSourceSuccess(sourceId: string, at: string): Promise<void> {
      const { error } = await sb.from('scraper_sources').update({ last_success_at: at }).eq('id', sourceId);
      if (error) logger.warn({ err: error.message }, 'markSourceSuccess: échec MAJ source');
    },
  };
}
