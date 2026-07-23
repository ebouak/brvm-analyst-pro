import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { buildSectorReport } from '@/lib/reports';
import SectorComparisonChart, { type SectorBar } from '@/components/SectorComparisonChart';
import ReportSummaryCard from '@/components/ReportSummaryCard';
import EventTimeline from '@/components/EventTimeline';
import type { Period } from '@/lib/types';

export const dynamic = 'force-dynamic';
const PERIODS: Period[] = ['1S', '1M', '3M', '6M', '1A', 'max'];

export default async function SectorReportPage({
  params, searchParams,
}: {
  params: { sector: string };
  searchParams: { period?: string };
}) {
  const sector = decodeURIComponent(params.sector);
  const period = (PERIODS.includes(searchParams.period as Period) ? searchParams.period : '3M') as Period;
  const supabase = createClient();
  const report = await buildSectorReport(supabase, sector, period);

  if (!report) {
    return (
      <div className="p-6">
        <Link href="/dashboard/reports" className="text-xs text-up">← Rapports</Link>
        <div className="mt-4 bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucun titre pour le secteur « {sector} ».
        </div>
      </div>
    );
  }

  const bars: SectorBar[] = report.titles.map((t) => ({ code: t.code, perf: t.performancePct }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <Link href="/dashboard/reports" className="text-xs text-up">← Rapports</Link>
          <h1 className="text-2xl font-semibold mt-1">Secteur · {sector}</h1>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Link key={p} href={`?period=${p}`}
              className={`text-xs px-2 py-1 rounded border ${p === period ? 'border-up text-up' : 'border-border text-muted hover:text-white'}`}>{p}</Link>
          ))}
        </div>
      </div>

      <ReportSummaryCard headline={report.explanation.headline} why={report.explanation.why} whyTitle="Analyse" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Metric label="Perf moyenne" value={report.averagePerf != null ? (report.averagePerf >= 0 ? '+' : '') + report.averagePerf.toFixed(2) + '%' : '—'} />
        <Metric label="Dispersion" value={report.dispersion != null ? report.dispersion.toFixed(2) + '%' : '—'} />
        <Metric label="Meilleur" value={report.best[0] ? `${report.best[0].code} ${report.best[0].performancePct?.toFixed(1)}%` : '—'} />
        <Metric label="Pire" value={report.worst[0] ? `${report.worst[0].code} ${report.worst[0].performancePct?.toFixed(1)}%` : '—'} />
      </div>

      <SectorComparisonChart data={bars} />

      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Événements sectoriels</h3>
        <EventTimeline events={report.events} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular text-base mt-0.5">{value}</div>
    </div>
  );
}
