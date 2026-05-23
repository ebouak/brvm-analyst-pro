import type { BacktestResult } from '@/lib/backtest';

function fmt(v: number, decimals = 1): string {
  return v.toFixed(decimals);
}

function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${fmt(v * 100)}%`;
}

function signClass(v: number): string {
  if (v > 0) return 'text-up tabular';
  if (v < 0) return 'text-down tabular';
  return 'text-muted tabular';
}

interface Props {
  result: BacktestResult;
}

const ROW_CLS = 'flex justify-between py-2 border-b border-border last:border-0';
const LABEL_CLS = 'text-sm text-muted';
const VAL_CLS = 'text-sm tabular';

export default function BacktestMetrics({ result }: Props) {
  const {
    totalReturn, annualizedReturn, volatility, maxDrawdown,
    sharpeRatio, winRate, numTrades, buyAndHoldReturn,
  } = result;

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">Métriques</h3>
      <div>
        <div className={ROW_CLS}>
          <span className={LABEL_CLS}>Rendement total</span>
          <span className={`${VAL_CLS} ${signClass(totalReturn)}`}>{pct(totalReturn)}</span>
        </div>
        <div className={ROW_CLS}>
          <span className={LABEL_CLS}>Rendement annualisé</span>
          <span className={`${VAL_CLS} ${signClass(annualizedReturn)}`}>{pct(annualizedReturn)}</span>
        </div>
        <div className={ROW_CLS}>
          <span className={LABEL_CLS}>Volatilité annualisée</span>
          <span className={`${VAL_CLS} text-muted`}>{fmt(volatility * 100)}%</span>
        </div>
        <div className={ROW_CLS}>
          <span className={LABEL_CLS}>Max Drawdown</span>
          <span className={`${VAL_CLS} text-down`}>{`-${fmt(maxDrawdown * 100)}%`}</span>
        </div>
        <div className={ROW_CLS}>
          <span className={LABEL_CLS}>Sharpe Ratio</span>
          <span className={`${VAL_CLS} text-muted`}>
            {sharpeRatio !== null ? fmt(sharpeRatio, 2) : '—'}
          </span>
        </div>
        <div className={ROW_CLS}>
          <span className={LABEL_CLS}>Win Rate</span>
          <span className={`${VAL_CLS} text-muted`}>{fmt(winRate * 100)}%</span>
        </div>
        <div className={ROW_CLS}>
          <span className={LABEL_CLS}>Trades</span>
          <span className={`${VAL_CLS} text-muted`}>{numTrades}</span>
        </div>
        <div className={ROW_CLS}>
          <span className={LABEL_CLS}>Buy &amp; Hold</span>
          <span className={`${VAL_CLS} ${signClass(buyAndHoldReturn)}`}>{pct(buyAndHoldReturn)}</span>
        </div>
      </div>
    </div>
  );
}
