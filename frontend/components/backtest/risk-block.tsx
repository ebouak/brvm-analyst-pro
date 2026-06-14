import type { BacktestRisk } from '@/types/backtest';
import { getRiskTone, toneSoftClass, toneTextClass, RISK_LABEL } from '@/lib/backtest-formatters';

function Metric({ label, hint, value }: { label: string; hint?: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
      <p className="mt-1 text-lg font-semibold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

const pct = (v: number, d = 1) => `${v.toFixed(d).replace('.', ',')} %`;

export function RiskBlock({ risk, showRiskDetails = false }: { risk: BacktestRisk; showRiskDetails?: boolean }) {
  const tone = getRiskTone(risk.riskLevel);
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Risque</p>
        {risk.riskLevel && (
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneSoftClass[tone]} ${toneTextClass[tone]}`}>
            {RISK_LABEL[risk.riskLevel]}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Plus forte baisse" hint="max drawdown" value={pct(risk.maxDrawdownPct)} />
        <Metric label="Irrégularité" hint="volatilité" value={pct(risk.volatilityPct)} />
        {risk.winRatePct != null && (
          <Metric label="Trades gagnants" hint="win rate" value={pct(risk.winRatePct, 0)} />
        )}
      </div>

      {showRiskDetails && (risk.sharpe != null || risk.sortino != null || risk.calmar != null) && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {risk.sharpe != null && <Metric label="Sharpe" value={risk.sharpe.toFixed(2)} />}
          {risk.sortino != null && <Metric label="Sortino" value={risk.sortino.toFixed(2)} />}
          {risk.calmar != null && <Metric label="Calmar" value={risk.calmar.toFixed(2)} />}
        </div>
      )}
    </section>
  );
}
