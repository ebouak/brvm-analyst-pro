'use client';
import ExecutiveSummary from './sections/ExecutiveSummary';
import MultiPriceChart, { type PriceSeries } from './sections/PriceChart';
import EventsTable from './sections/EventsTable';
import SignalsTable from './sections/SignalsTable';
import StatsTable, { type StatRow } from './sections/StatsTable';

export interface ReportData {
  dateFrom: string;
  dateTo: string;
  marketRows: {
    code: string;
    designation?: string | null;
    variation_pct: number | null;
    cours_jour?: number | null;
  }[];
  priceSeries: PriceSeries[];
  events: {
    id: string;
    event_date: string;
    title: string;
    event_type: string;
    instrument_code: string | null;
    sentiment: 'positive' | 'neutral' | 'negative' | null;
  }[];
  signals: {
    code: string;
    date_marche: string;
    signal: 'BUY' | 'HOLD' | 'SELL';
    score_total: number;
    confiance: number | null;
    explication: string | null;
  }[];
  statRows: StatRow[];
}

interface Props {
  data: ReportData;
  onExportPDF?: () => void;
}

export default function ReportView({ data, onExportPDF }: Props) {
  return (
    <div className="space-y-4" id="report-root">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Rapport BRVM{' '}
          <span className="text-muted text-sm font-normal tabular">
            {data.dateFrom} → {data.dateTo}
          </span>
        </h1>
        {onExportPDF && (
          <button
            onClick={onExportPDF}
            className="text-sm border border-border rounded px-4 py-1.5 text-muted hover:border-up/50 hover:text-up transition"
          >
            Exporter PDF
          </button>
        )}
      </div>

      <ExecutiveSummary
        rows={data.marketRows}
        dateFrom={data.dateFrom}
        dateTo={data.dateTo}
      />
      <MultiPriceChart series={data.priceSeries} />
      <EventsTable events={data.events} />
      <SignalsTable signals={data.signals} />
      <StatsTable rows={data.statRows} />
    </div>
  );
}
