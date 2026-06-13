import type { BacktestResult } from '@/lib/backtest';
import { rateMetric, type Rating, type MetricKey } from '@/lib/backtest/interpret';

function fmt(v: number, decimals = 1): string {
  return v.toFixed(decimals);
}
function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${fmt(v * 100)}%`;
}
function signClass(v: number): string {
  if (v > 0) return 'text-up';
  if (v < 0) return 'text-down';
  return 'text-muted';
}

const RATING_DOT: Record<Rating, string> = {
  good: 'bg-up',
  neutral: 'bg-warn',
  poor: 'bg-down',
};
const RATING_LABEL: Record<Rating, string> = {
  good: 'Bon',
  neutral: 'Moyen',
  poor: 'Faible',
};

/** Carte simple sans jugement (performance brute). */
function PlainCard({ label, value, cls, hint }: { label: string; value: string; cls?: string; hint: string }) {
  return (
    <div className="bg-bg/40 border border-border/60 rounded-xl p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`tabular text-xl font-mono font-semibold ${cls ?? 'text-white'}`}>{value}</div>
      <p className="mt-1.5 text-[10px] text-faint leading-snug">{hint}</p>
    </div>
  );
}

/** Carte notée (bon / moyen / faible) selon les seuils analystes. */
function RatedCard({ label, value, metricKey, rawValue }: { label: string; value: string; metricKey: MetricKey; rawValue: number | null }) {
  const { rating, explanation } = rateMetric(metricKey, rawValue);
  return (
    <div className="bg-bg/40 border border-border/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted">{label}</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-faint">
          <span className={`h-1.5 w-1.5 rounded-full ${RATING_DOT[rating]}`} />
          {RATING_LABEL[rating]}
        </span>
      </div>
      <div className="tabular text-xl font-mono font-semibold text-white">{value}</div>
      <p className="mt-1.5 text-[10px] text-faint leading-snug">{explanation}</p>
    </div>
  );
}

interface Props {
  result: BacktestResult;
}

export default function BacktestMetrics({ result }: Props) {
  const {
    totalReturn, annualizedReturn, volatility, maxDrawdown,
    sharpeRatio, sortinoRatio, calmarRatio, winRate, numTrades, buyAndHoldReturn,
  } = result;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-5">
      {/* Performance */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-faint mb-3">Performance</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <PlainCard label="Rendement total" value={pct(totalReturn)} cls={signClass(totalReturn)}
            hint="Gain/perte cumulé de la stratégie sur la période." />
          <PlainCard label="Annualisé" value={`${pct(annualizedReturn)}/an`} cls={signClass(annualizedReturn)}
            hint="Rendement ramené à une base annuelle (CAGR)." />
          <PlainCard label="Buy & Hold" value={pct(buyAndHoldReturn)} cls={signClass(buyAndHoldReturn)}
            hint="Référence : acheter au début et conserver." />
          <PlainCard label="Nb trades" value={String(numTrades)} cls="text-white"
            hint="Nombre d'allers-retours. Trop peu = peu significatif." />
        </div>
      </div>

      {/* Risque */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-faint mb-3">Risque ajusté</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <RatedCard label="Sharpe" value={sharpeRatio != null ? fmt(sharpeRatio, 2) : '—'} metricKey="sharpe" rawValue={sharpeRatio} />
          <RatedCard label="Sortino" value={sortinoRatio != null ? fmt(sortinoRatio, 2) : '—'} metricKey="sortino" rawValue={sortinoRatio} />
          <RatedCard label="Calmar" value={calmarRatio != null ? fmt(calmarRatio, 2) : '—'} metricKey="calmar" rawValue={calmarRatio} />
          <RatedCard label="Max Drawdown" value={`-${fmt(maxDrawdown * 100)}%`} metricKey="maxDrawdown" rawValue={maxDrawdown} />
        </div>
      </div>

      {/* Exécution */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-faint mb-3">Exécution & régularité</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <RatedCard label="Win Rate" value={`${fmt(winRate * 100)}%`} metricKey="winRate" rawValue={winRate} />
          <RatedCard label="Volatilité" value={`${fmt(volatility * 100)}%`} metricKey="volatility" rawValue={volatility} />
          <PlainCard label="Gain moyen" value={result.avgWinPct != null ? pct(result.avgWinPct) : '—'} cls="text-up"
            hint="Rendement moyen des trades gagnants." />
          <PlainCard label="Perte moyenne" value={result.avgLossPct != null ? pct(result.avgLossPct) : '—'} cls="text-down"
            hint="Rendement moyen des trades perdants." />
        </div>
      </div>
    </div>
  );
}
