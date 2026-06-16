import { getServiceClient } from '@/lib/billing/serviceClient';

const TTL_MS = 7 * 24 * 3600 * 1000; // 7 jours (TTL applicatif des diagnostics)

export interface DiagnosticRow {
  code: string;
  model_used: string;
  generated_at: string | null;
  stale: boolean;
}
export interface DiagnosticsDashboard {
  rows: DiagnosticRow[];
  kpis: { total: number; stale: number; byModel: Record<string, number> };
}

/** Diagnostics IA (un par action) + KPIs (fraîcheur, répartition modèles). */
export async function loadDiagnostics(): Promise<DiagnosticsDashboard> {
  const db = getServiceClient();
  const { data } = await db
    .from('diagnostic_reports')
    .select('code, model_used, generated_at')
    .order('generated_at', { ascending: false })
    .limit(500);
  const now = Date.now();
  const rows: DiagnosticRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const gen = (r.generated_at as string) ?? null;
    const stale = gen ? now - new Date(gen).getTime() > TTL_MS : true;
    return { code: r.code as string, model_used: (r.model_used as string) || 'inconnu', generated_at: gen, stale };
  });
  const byModel: Record<string, number> = {};
  for (const r of rows) byModel[r.model_used] = (byModel[r.model_used] ?? 0) + 1;
  return { rows, kpis: { total: rows.length, stale: rows.filter((r) => r.stale).length, byModel } };
}

export interface MonthlyReportRow {
  id: string;
  user_email: string | null;
  month: string;
  sent_at: string | null;
  report_url: string | null;
}
export interface MonthlyReportsDashboard {
  rows: MonthlyReportRow[];
  kpis: { total: number; sent: number };
}

/** Rapports mensuels (métadonnées seulement, PII non exposée) + email enrichi. */
export async function loadMonthlyReports(): Promise<MonthlyReportsDashboard> {
  const db = getServiceClient();
  const { data } = await db
    .from('monthly_reports')
    .select('id, user_id, month, sent_at, report_url')
    .order('month', { ascending: false })
    .limit(300);
  const raw = (data ?? []) as Record<string, unknown>[];
  const userIds = Array.from(new Set(raw.map((r) => r.user_id as string).filter(Boolean)));
  const emailById = new Map<string, string | null>();
  if (userIds.length) {
    const { data: profs } = await db.from('profiles').select('id, email').in('id', userIds);
    for (const p of (profs ?? []) as { id: string; email: string | null }[]) emailById.set(p.id, p.email);
  }
  const rows: MonthlyReportRow[] = raw.map((r) => ({
    id: r.id as string,
    user_email: emailById.get(r.user_id as string) ?? null,
    month: r.month as string,
    sent_at: (r.sent_at as string) ?? null,
    report_url: (r.report_url as string) ?? null,
  }));
  return { rows, kpis: { total: rows.length, sent: rows.filter((r) => r.sent_at).length } };
}
