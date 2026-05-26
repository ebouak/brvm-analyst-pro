import { createClient } from '@/lib/supabase/server';
import { runBacktest, type BacktestResult } from '@/lib/backtest';
import type { SignalLabel } from '@/lib/types';
import BacktestChart from '@/components/BacktestChart';
import BacktestMetrics from '@/components/BacktestMetrics';
import BacktestExport from '@/components/BacktestExport';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Backtest' };

type Period = '1M' | '3M' | '6M' | '1A' | 'max';

function isPeriod(s: unknown): s is Period {
  return ['1M', '3M', '6M', '1A', 'max'].includes(s as string);
}

function periodToDate(period: Period): string | null {
  const now = new Date();
  const map: Record<Period, () => Date | null> = {
    '1M': () => new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
    '3M': () => new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
    '6M': () => new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
    '1A': () => new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
    'max': () => null,
  };
  const d = map[period]();
  return d ? d.toISOString().slice(0, 10) : null;
}

function simpleSignal(closes: number[]): SignalLabel[] {
  return closes.map((c, i) => {
    if (i === 0) return 'HOLD';
    const variationPct = ((c - closes[i - 1]!) / closes[i - 1]!) * 100;
    if (variationPct > 2) return 'BUY';
    if (variationPct < -2) return 'SELL';
    return 'HOLD';
  });
}

function generateNarrative(
  result: BacktestResult,
  _code: string
): { strengths: string[]; limits: string[] } {
  const strengths: string[] = [];
  const limits: string[] = [];

  const outperformance = result.totalReturn - result.buyAndHoldReturn;
  if (outperformance > 0) {
    strengths.push(
      `Surperforme le Buy & Hold de ${(outperformance * 100).toFixed(1)} points`
    );
  } else {
    limits.push(
      `Sous-performe le Buy & Hold de ${Math.abs(outperformance * 100).toFixed(1)} points`
    );
  }

  if (result.maxDrawdown < 0.15) {
    strengths.push(`Drawdown maîtrisé (${(result.maxDrawdown * 100).toFixed(1)}%)`);
  } else {
    limits.push(`Drawdown élevé (${(result.maxDrawdown * 100).toFixed(1)}%)`);
  }

  if (result.winRate >= 0.55) {
    strengths.push(`Win rate favorable (${(result.winRate * 100).toFixed(0)}%)`);
  }

  if (result.numTrades < 10) {
    limits.push(
      `Peu de trades (${result.numTrades}) — résultats peu significatifs statistiquement`
    );
  }

  if (result.sharpeRatio !== null && result.sharpeRatio > 1) {
    strengths.push(`Bon ratio Sharpe (${result.sharpeRatio.toFixed(2)})`);
  }

  return { strengths, limits };
}

interface Instrument {
  code: string;
  designation: string | null;
}

interface PageProps {
  searchParams: {
    code?: string;
    period?: string;
    dateFrom?: string;
    dateTo?: string;
    fees?: string;
    slippage?: string;
  };
}

export default async function BacktestPage({ searchParams }: PageProps) {
  const supabase = createClient();

  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, designation')
    .eq('type', 'action')
    .order('code', { ascending: true });

  const instrumentList = (instruments ?? []) as Instrument[];

  const selectedCode = searchParams.code ?? '';
  const rawPeriod = searchParams.period ?? '1A';
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : '1A';
  const dateFrom = searchParams.dateFrom ?? '';
  const dateTo = searchParams.dateTo ?? '';
  const feesPct = parseFloat(searchParams.fees ?? '0.006');
  const slippagePct = parseFloat(searchParams.slippage ?? '0');

  let result: BacktestResult | null = null;
  let designation = '';
  let noData = false;
  let closes: number[] = [];
  let dates: string[] = [];

  if (selectedCode) {
    designation =
      instrumentList.find((i) => i.code === selectedCode)?.designation ?? selectedCode;

    let query = supabase
      .from('brvm_actions_daily')
      .select('cours_jour, date_marche')
      .eq('code', selectedCode)
      .order('date_marche', { ascending: true })
      .not('cours_jour', 'is', null);

    if (dateFrom) {
      query = query.gte('date_marche', dateFrom);
    } else {
      const fromDate = periodToDate(period);
      if (fromDate) {
        query = query.gte('date_marche', fromDate);
      }
    }

    if (dateTo) {
      query = query.lte('date_marche', dateTo);
    }

    const { data: rows } = await query;
    const priceRows = (rows ?? []) as { cours_jour: number; date_marche: string }[];

    if (priceRows.length < 2) {
      noData = true;
    } else {
      closes = priceRows.map((r) => r.cours_jour);
      dates = priceRows.map((r) => r.date_marche);
      const signals = simpleSignal(closes);
      result = runBacktest({ closes, signals, dates, feesPct, slippagePct });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Backtest de stratégie</h1>
        <p className="text-xs text-muted">
          Signal : variation &gt; 2% → BUY, &lt; -2% → SELL, sinon HOLD
        </p>
      </div>

      <form method="GET" action="" className="flex flex-wrap items-end gap-3">
        {/* Instrument */}
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-xs text-muted">Instrument</label>
          <select
            id="code"
            name="code"
            defaultValue={selectedCode}
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-white min-w-[180px]"
          >
            <option value="">-- Choisir --</option>
            {instrumentList.map((ins) => (
              <option key={ins.code} value={ins.code}>
                {ins.code}{ins.designation ? ` – ${ins.designation}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label htmlFor="dateFrom" className="text-xs text-muted">Du</label>
          <input
            id="dateFrom"
            type="date"
            name="dateFrom"
            defaultValue={dateFrom}
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="dateTo" className="text-xs text-muted">Au</label>
          <input
            id="dateTo"
            type="date"
            name="dateTo"
            defaultValue={dateTo}
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-white"
          />
        </div>

        {/* Fallback period when no date range */}
        <div className="flex flex-col gap-1">
          <label htmlFor="period" className="text-xs text-muted">Période (si sans dates)</label>
          <select
            id="period"
            name="period"
            defaultValue={period}
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-white"
          >
            <option value="1M">1 mois</option>
            <option value="3M">3 mois</option>
            <option value="6M">6 mois</option>
            <option value="1A">1 an</option>
            <option value="max">Max</option>
          </select>
        </div>

        {/* Frais */}
        <div className="flex flex-col gap-1">
          <label htmlFor="fees" className="text-xs text-muted">Frais</label>
          <input
            id="fees"
            type="number"
            name="fees"
            step="0.001"
            min="0"
            max="0.1"
            defaultValue={feesPct}
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-white w-24"
          />
        </div>

        {/* Slippage */}
        <div className="flex flex-col gap-1">
          <label htmlFor="slippage" className="text-xs text-muted">Slippage</label>
          <input
            id="slippage"
            type="number"
            name="slippage"
            step="0.001"
            min="0"
            max="0.1"
            defaultValue={slippagePct}
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-white w-24"
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 rounded bg-up text-black text-sm font-semibold hover:opacity-90"
        >
          Analyser
        </button>
      </form>

      {!selectedCode && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Sélectionnez un instrument pour lancer le backtest.
        </div>
      )}

      {selectedCode && noData && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucun historique de cours disponible pour{' '}
          <span className="tabular text-white">{selectedCode}</span> sur cette période.
        </div>
      )}

      {result && (
        <>
          <p className="text-sm text-muted">
            Instrument : <span className="text-white">{selectedCode}</span>
            {designation && designation !== selectedCode && (
              <> — <span className="text-white">{designation}</span></>
            )}
            {(feesPct > 0 || slippagePct > 0) && (
              <span className="ml-2 text-xs">
                (frais {(feesPct * 100).toFixed(2)}%
                {slippagePct > 0 ? ` + slippage ${(slippagePct * 100).toFixed(2)}%` : ''})
              </span>
            )}
          </p>

          {/* Chart full width */}
          <BacktestChart
            equityCurve={result.equityCurve}
            closes={closes}
            dates={dates}
            drawdownPeriods={result.drawdownPeriods}
          />

          {/* Metrics */}
          <BacktestMetrics result={result} />

          {/* Narrative */}
          {(() => {
            const { strengths, limits } = generateNarrative(result, selectedCode);
            return (
              <div className="bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3">💡 Synthèse</h3>
                <div className="space-y-4 text-sm">
                  {strengths.length > 0 && (
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wide mb-1">Points forts</p>
                      <ul className="space-y-1">
                        {strengths.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-up">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {limits.length > 0 && (
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wide mb-1">Limites</p>
                      <ul className="space-y-1">
                        {limits.map((l, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted">•</span>
                            <span>{l}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted italic border-t border-border/50 pt-3">
                    ⚠️ Les résultats passés ne garantissent pas les performances futures.
                    Ce backtest est fourni à titre informatif uniquement.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <BacktestExport
              equityCurve={result.equityCurve}
              closes={closes}
              dates={dates}
              code={selectedCode}
            />
            <a
              href="/backtest"
              className="text-xs border border-border text-muted rounded px-3 py-1.5 hover:text-up hover:border-up/40 transition"
            >
              🧪 Tester un autre
            </a>
          </div>
        </>
      )}
    </div>
  );
}
