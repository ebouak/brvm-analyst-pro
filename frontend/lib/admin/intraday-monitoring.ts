import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export interface JobRunRow {
  id: number;
  date_marche: string;
  phase: string;
  job_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  rows_in: number | null;
  rows_out: number | null;
  errors_count: number;
  warnings_count: number;
}

export interface PatternErrorRow {
  id: number;
  date_marche: string;
  phase: string;
  code: string | null;
  table_name: string;
  error_message: string;
  error_code: string | null;
  created_at: string;
}

export interface PatternScoreRow {
  date_marche: string;
  patterns_detected_count: number;
}

export interface IntraDayMonitoringDashboard {
  runs: JobRunRow[];
  errors: PatternErrorRow[];
  scores: PatternScoreRow[];
  kpis: {
    runs24h: number;
    success_count: number;
    failed_count: number;
    patterns_detected: number;
    avg_duration_ms: number | null;
    latest_status: string;
  };
}

export async function loadIntraDayMonitoring(): Promise<IntraDayMonitoringDashboard> {
  const db = getAdminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const today = new Date().toISOString().split('T')[0];

  const [runsRes, errorsRes, scoresRes] = await Promise.all([
    db
      .from('brvm_intraday_job_runs')
      .select('*')
      .gte('created_at', since)
      .order('started_at', { ascending: false })
      .limit(50),
    db
      .from('brvm_pattern_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
    db
      .from('brvm_pattern_scores')
      .select('date_marche, patterns_detected_count')
      .gte('date_marche', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0])
      .order('date_marche', { ascending: false }),
  ]);

  const runs: JobRunRow[] = (runsRes.data ?? []) as JobRunRow[];
  const errors: PatternErrorRow[] = (errorsRes.data ?? []) as PatternErrorRow[];
  const scores: PatternScoreRow[] = (scoresRes.data ?? []) as PatternScoreRow[];

  const recent24h = runs.filter(r => r.started_at >= since);
  const success_count = recent24h.filter(r => r.status === 'SUCCESS' || r.status === 'PARTIAL').length;
  const failed_count = recent24h.filter(r => r.status === 'FAILED').length;
  const patterns_detected = scores.reduce((sum, s) => sum + (s.patterns_detected_count || 0), 0);
  const avg_duration_ms =
    recent24h.length > 0
      ? Math.round(recent24h.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / recent24h.length)
      : null;

  return {
    runs,
    errors,
    scores,
    kpis: {
      runs24h: recent24h.length,
      success_count,
      failed_count,
      patterns_detected,
      avg_duration_ms,
      latest_status: runs[0]?.status || 'N/A',
    },
  };
}
