// GET /api/metrics  — format texte Prometheus (exposition v0.0.4).
// Métriques agrégées depuis Supabase pour monitoring (cf. spec §11.3).
// À scraper depuis Prometheus avec un bearer optionnel si METRICS_TOKEN défini.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Metric {
  name: string;
  help: string;
  type: 'gauge' | 'counter';
  value: number;
  labels?: Record<string, string>;
}

function render(metrics: Metric[]): string {
  // Group by name to emit HELP/TYPE once.
  const byName = new Map<string, Metric[]>();
  for (const m of metrics) {
    const list = byName.get(m.name) ?? [];
    list.push(m);
    byName.set(m.name, list);
  }
  const lines: string[] = [];
  for (const [name, items] of byName) {
    lines.push(`# HELP ${name} ${items[0]!.help}`);
    lines.push(`# TYPE ${name} ${items[0]!.type}`);
    for (const m of items) {
      const lbls = m.labels
        ? '{' + Object.entries(m.labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
        : '';
      lines.push(`${name}${lbls} ${m.value}`);
    }
  }
  return lines.join('\n') + '\n';
}

export async function GET(req: NextRequest) {
  // Bearer requis (fail-closed) : sans METRICS_TOKEN configuré, l'endpoint
  // est indisponible plutôt que public — il expose des comptages de tables
  // internes (scraper_logs, data_quality_alerts…).
  const expected = process.env.METRICS_TOKEN;
  if (!expected) {
    return new NextResponse('metrics disabled: METRICS_TOKEN not configured', { status: 503 });
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const supabase = createClient();
  const metrics: Metric[] = [];

  // Comptages bruts par table.
  const tables: { table: string; label: string }[] = [
    { table: 'brvm_instruments', label: 'instruments' },
    { table: 'brvm_actions_daily', label: 'actions_daily' },
    { table: 'brvm_obligations_daily', label: 'obligations_daily' },
    { table: 'brvm_indices_daily', label: 'indices_daily' },
    { table: 'signals_daily', label: 'signals_daily' },
    { table: 'market_events', label: 'market_events' },
    { table: 'dividends', label: 'dividends' },
    { table: 'technical_indicators', label: 'technical_indicators' },
    { table: 'data_quality_alerts', label: 'data_quality_alerts' },
    { table: 'scraper_logs', label: 'scraper_logs' },
  ];

  await Promise.all(tables.map(async ({ table, label }) => {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    metrics.push({
      name: 'brvm_rows_total',
      help: 'Nombre de lignes par table.',
      type: 'gauge',
      value: count ?? 0,
      labels: { table: label },
    });
  }));

  // Alertes qualité non acquittées par sévérité.
  const { data: dqaRows } = await supabase
    .from('data_quality_alerts')
    .select('severity, is_acknowledged');
  const dqaCount: Record<string, number> = { info: 0, warning: 0, critical: 0 };
  for (const r of (dqaRows ?? []) as { severity: string; is_acknowledged: boolean }[]) {
    if (!r.is_acknowledged) dqaCount[r.severity] = (dqaCount[r.severity] ?? 0) + 1;
  }
  for (const [sev, n] of Object.entries(dqaCount)) {
    metrics.push({
      name: 'brvm_data_quality_alerts_unack',
      help: 'Alertes qualité non acquittées par sévérité.',
      type: 'gauge',
      value: n,
      labels: { severity: sev },
    });
  }

  // Dernier run de chaque worker (epoch seconds depuis run_at).
  const { data: lastRuns } = await supabase
    .from('v_scraper_last_runs')
    .select('function_name, run_at, status');
  for (const r of (lastRuns ?? []) as { function_name: string; run_at: string; status: string }[]) {
    const ageSeconds = (Date.now() - new Date(r.run_at).getTime()) / 1000;
    metrics.push({
      name: 'brvm_scraper_last_run_age_seconds',
      help: 'Âge en secondes du dernier run d\'un worker.',
      type: 'gauge',
      value: Math.round(ageSeconds),
      labels: { function: r.function_name, status: r.status },
    });
  }

  return new NextResponse(render(metrics), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
  });
}
