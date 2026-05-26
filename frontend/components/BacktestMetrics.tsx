import type { BacktestResult } from '@/lib/backtest';

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

interface MetricCardProps {
  label: string;
  value: string;
  cls?: string;
}

function MetricCard({ label, value, cls }: MetricCardProps) {
  return (
    <div className="bg-bg/40 border border-border/60 rounded-xl p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`tabular text-xl font-mono font-semibold ${cls ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

interface Props {
  result: BacktestResult;
}

export default function BacktestMetrics({ result }: Props) {
  const {
    totalReturn, annualizedReturn, volatility, maxDrawdown,
    sharpeRatio, winRate, numTrades, buyAndHoldReturn,
  } = result;

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">Métriques</h3>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Rendement total"
          value={pct(totalReturn)}
          cls={signClass(totalReturn)}
        />
        <MetricCard
          label="Rendement B&H"
          value={pct(buyAndHoldReturn)}
          cls={signClass(buyAndHoldReturn)}
        />
        <MetricCard
          label="Annualisé"
          value={`${pct(annualizedReturn)}/an`}
          cls={signClass(annualizedReturn)}
        />
        <MetricCard
          label="Volatilité"
          value={`${fmt(volatility * 100)}%`}
          cls="text-muted"
        />
        <MetricCard
          label="Max Drawdown"
          value={`-${fmt(maxDrawdown * 100)}%`}
          cls="text-down"
        />
        <MetricCard
          label="Win Rate"
          value={`${fmt(winRate * 100)}%`}
          cls="text-white"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={sharpeRatio !== null ? fmt(sharpeRatio, 2) : '—'}
          cls="text-white"
        />
        <MetricCard
          label="Nb Trades"
          value={String(numTrades)}
          cls="text-white"
        />
      </div>
    </div>
  );
}
