import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/** Client service-role en lecture seule (bypass RLS) — server-only. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export interface ScraperRunRow {
  id: string;
  source_code: string | null;
  source_label: string | null;
  trigger_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  rows_upserted: number;
  error_count: number;
}

export interface ScraperErrorRow {
  id: string;
  source_code: string | null;
  error_type: string | null;
  error_message: string | null;
  created_at: string | null;
}

export interface ScrapingDashboard {
  runs: ScraperRunRow[];
  errors: ScraperErrorRow[];
  kpis: {
    runs24h: number;
    successRate24h: number | null; // 0..1 ; null si aucun run
    rowsUpserted24h: number;
    openErrors: number;
  };
}

/** Charge les runs récents, erreurs ouvertes et KPIs 24h. Tolérant aux pannes (renvoie vide). */
export async function loadScrapingDashboard(): Promise<ScrapingDashboard> {
  const db = getAdminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [runsRes, errorsRes] = await Promise.all([
    db
      .from('scraper_runs')
      .select('id, trigger_type, status, started_at, finished_at, duration_ms, rows_upserted, error_count, scraper_sources(code, label)')
      .order('started_at', { ascending: false })
      .limit(40),
    db
      .from('scraper_errors')
      .select('id, source_code, error_type, error_message, created_at')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const runs: ScraperRunRow[] = (runsRes.data ?? []).map((r: Record<string, unknown>) => {
    const srcRaw = r.scraper_sources as unknown;
    const src = Array.isArray(srcRaw)
      ? (srcRaw[0] as { code?: string; label?: string } | null)
      : (srcRaw as { code?: string; label?: string } | null);
    return {
      id: r.id as string,
      source_code: src?.code ?? null,
      source_label: src?.label ?? null,
      trigger_type: r.trigger_type as string,
      status: r.status as string,
      started_at: (r.started_at as string) ?? null,
      finished_at: (r.finished_at as string) ?? null,
      duration_ms: (r.duration_ms as number) ?? null,
      rows_upserted: (r.rows_upserted as number) ?? 0,
      error_count: (r.error_count as number) ?? 0,
    };
  });

  const errors: ScraperErrorRow[] = (errorsRes.data ?? []) as ScraperErrorRow[];

  const recent = runs.filter((r) => r.started_at && r.started_at >= since && r.status !== 'running');
  const ok = recent.filter((r) => r.status === 'success' || r.status === 'partial').length;
  const kpis = {
    runs24h: recent.length,
    successRate24h: recent.length > 0 ? ok / recent.length : null,
    rowsUpserted24h: recent.reduce((acc, r) => acc + (r.rows_upserted ?? 0), 0),
    openErrors: errors.length,
  };

  return { runs, errors, kpis };
}
