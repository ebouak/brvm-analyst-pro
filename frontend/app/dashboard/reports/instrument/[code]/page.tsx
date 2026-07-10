import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { buildInstrumentReport } from '@/lib/reports';
import PriceChart, { type PricePoint } from '@/components/PriceChart';
import IndicatorCharts, { type IndicatorPoint } from '@/components/IndicatorCharts';
import EventTimeline from '@/components/EventTimeline';
import ReportSummaryCard from '@/components/ReportSummaryCard';
import SignalBadge from '@/components/SignalBadge';
import ExportReportButton from '@/components/ExportReportButton';
import SaveReportButton from '@/components/SaveReportButton';
import { fmtNumber } from '@/lib/format';
import type { Period } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PERIODS: Period[] = ['1S', '1M', '3M', '6M', '1A', 'max'];

export default async function InstrumentReportPage({
  params, searchParams,
}: {
  params: { code: string };
  searchParams: { period?: string };
}) {
  const code = decodeURIComponent(params.code);
  const period = (PERIODS.includes(searchParams.period as Period) ? searchParams.period : '3M') as Period;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const report = await buildInstrumentReport(supabase, code, period);

  if (!report) {
    return (
      <div className="p-6">
        <Link href="/dashboard/reports" className="text-xs text-up">← Rapports</Link>
        <div className="mt-4 bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucune donnée pour {code}.
        </div>
      </div>
    );
  }

  const priceData: PricePoint[] = report.timeseries.map((t) => ({
    date: t.date, close: t.close, ma20: t.ma20, ma50: t.ma50, ma200: t.ma200, volume: t.volume,
  }));
  const indicatorData: IndicatorPoint[] = report.timeseries.map((t) => ({
    date: t.date, rsi: t.rsi, macd: t.macd, signal: t.signal, hist: t.hist,
  }));

  const det = report.technicalIndicators.detection;
  const badges: { label: string; cls: string }[] = [];
  if (det.oversold) badges.push({ label: 'Survente', cls: 'text-up border-up/40' });
  if (det.overbought) badges.push({ label: 'Surachat', cls: 'text-down border-down/40' });
  if (det.goldenCross) badges.push({ label: 'Croisement haussier', cls: 'text-up border-up/40' });
  if (det.deathCross) badges.push({ label: 'Croisement baissier', cls: 'text-down border-down/40' });
  if (det.breakoutUp) badges.push({ label: 'Cassure haussière', cls: 'text-up border-up/40' });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <Link href="/dashboard/reports" className="text-xs text-up">← Rapports</Link>
          <h1 className="text-2xl font-semibold mt-1">
            {code} <span className="text-base text-muted font-normal">{report.instrument.designation}</span>
          </h1>
          <p className="text-xs text-muted">
            {[report.instrument.secteur, report.instrument.pays].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Link key={p} href={`?period=${p}`}
                className={`text-xs px-2 py-1 rounded border ${p === period ? 'border-up text-up' : 'border-border text-muted hover:text-white'}`}>
                {p}
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            <SaveReportButton reportType="instrument" title={`Rapport ${code} (${period})`} params={{ code, period }} canSave={!!user} />
            <ExportReportButton />
          </div>
        </div>
      </div>

      <ReportSummaryCard headline={report.explanation.headline} why={report.explanation.why} badges={badges} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Metric label={`Perf ${period}`} value={report.summary.performancePct != null ? (report.summary.performancePct >= 0 ? '+' : '') + report.summary.performancePct.toFixed(2) + '%' : '—'} />
        <Metric label="RSI(14)" value={report.technicalIndicators.rsi != null ? report.technicalIndicators.rsi.toFixed(0) : '—'} />
        <Metric label="Volatilité" value={report.summary.volatility != null ? (report.summary.volatility * 100).toFixed(2) + '%' : '—'} />
        <Metric label="Vol/Moy" value={report.summary.volumeRatio != null ? report.summary.volumeRatio.toFixed(2) + 'x' : '—'} />
      </div>

      <PriceChart data={priceData} />
      <IndicatorCharts data={indicatorData} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Événements liés</h3>
          <EventTimeline events={report.events} />
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Signaux récents</h3>
          {report.signals.length === 0 ? (
            <p className="text-xs text-muted">Aucun signal généré.</p>
          ) : (
            <div className="space-y-2">
              {report.signals.slice(0, 6).map((s) => (
                <div key={s.date_marche} className="flex items-center justify-between text-sm">
                  <span className="tabular text-muted">{s.date_marche}</span>
                  <SignalBadge signal={s.signal} confiance={s.confiance} small />
                  <span className="tabular text-xs">{fmtNumber(s.score_total, 2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
