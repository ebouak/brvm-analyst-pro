import { fmtFcfa, fmtNumber } from '@/lib/format';

export interface MarketSummaryRow {
  date_marche: string;
  valeur_transactions: number | null;
  capitalisation_actions: number | null;
  capitalisation_obligations: number | null;
}

function pctDelta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-faint text-[11px]">—</span>;
  const up = pct >= 0;
  return (
    <span className={`tabular text-[11px] font-medium ${up ? 'text-up' : 'text-down'}`}>
      vs veille {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function Row({ label, value, delta }: { label: string; value: React.ReactNode; delta?: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center gap-2 text-right">
        <span className="tabular text-sm font-semibold text-ivory">{value}</span>
        {delta !== undefined && <Delta pct={delta} />}
      </span>
    </div>
  );
}

/** Repères clés de séance — totaux réels (brvm.org « Activités du marché »). */
export default function KeyMetrics({
  summary,
  summaryPrev,
}: {
  summary: MarketSummaryRow | null;
  summaryPrev: MarketSummaryRow | null;
}) {
  if (!summary) return null;

  const capTotale =
    summary.capitalisation_actions != null || summary.capitalisation_obligations != null
      ? (summary.capitalisation_actions ?? 0) + (summary.capitalisation_obligations ?? 0)
      : null;
  const capTotalePrev =
    summaryPrev && (summaryPrev.capitalisation_actions != null || summaryPrev.capitalisation_obligations != null)
      ? (summaryPrev.capitalisation_actions ?? 0) + (summaryPrev.capitalisation_obligations ?? 0)
      : null;

  // Activité du marché : qualifiée à partir du volume vs veille (donnée réelle).
  const volDelta = pctDelta(summary.valeur_transactions, summaryPrev?.valeur_transactions ?? null);
  const activite =
    volDelta == null ? 'NORMAL'
    : volDelta >= 20 ? 'SOUTENUE'
    : volDelta <= -20 ? 'FAIBLE'
    : 'NORMAL';
  const activiteCls =
    activite === 'SOUTENUE' ? 'text-up' : activite === 'FAIBLE' ? 'text-down' : 'text-muted';

  return (
    <div>
      <p className="overline text-faint mb-1">Repères clés</p>
      <Row
        label="Volume des échanges"
        value={summary.valeur_transactions != null ? `${fmtFcfa(summary.valeur_transactions)} FCFA` : '—'}
        delta={volDelta}
      />
      <Row
        label="Capitalisation boursière"
        value={capTotale != null ? `${fmtFcfa(capTotale)} FCFA` : '—'}
        delta={pctDelta(capTotale, capTotalePrev)}
      />
      <Row label="Nombre de transactions" value={<span className="text-faint">non publié</span>} />
      <div className="flex items-center justify-between gap-3 py-2">
        <span className="text-xs text-muted">Activité du marché</span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${activiteCls}`}>{activite}</span>
      </div>
    </div>
  );
}
