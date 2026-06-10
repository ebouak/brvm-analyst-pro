import { createClient } from '@/lib/supabase/server';
import { runBacktest, type BacktestResult } from '@/lib/backtest';
import type { SignalLabel } from '@/lib/types';
import BacktestChart from '@/components/BacktestChart';
import BacktestMetrics from '@/components/BacktestMetrics';
import BacktestExport from '@/components/BacktestExport';
import {
  SectionHeader,
  PremiumPanel,
  EmptyStatePremium,
  StatPill,
  Eyebrow,
} from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Backtest' };

type BacktestResultEx = BacktestResult & { hasRealSignals?: boolean };

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

/* ── Shared input/select class ──────────────────────────────────────────── */
const inputCls =
  'bg-bg border border-border rounded-lg px-3 py-2 text-sm text-ivory placeholder:text-faint focus:outline-none focus:border-gold/50 transition-colors duration-200';

export default async function BacktestPage({ searchParams }: PageProps) {
  const supabase = createClient();

  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, designation')
    .eq('type', 'action')
    .order('code', { ascending: true });

  const instrumentList = (instruments ?? []) as Instrument[];

  const selectedCode = searchParams.code ?? '';
  const rawPeriod = searchParams.period ?? 'max';
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : 'max';
  const dateFrom = searchParams.dateFrom ?? '';
  const dateTo = searchParams.dateTo ?? '';
  const feesPct = parseFloat(searchParams.fees ?? '0.006');
  const slippagePct = parseFloat(searchParams.slippage ?? '0');

  let result: BacktestResultEx | null = null;
  let designation = '';
  let noData = false;
  let closes: number[] = [];
  let dates: string[] = [];

  if (selectedCode) {
    designation =
      instrumentList.find((i) => i.code === selectedCode)?.designation ?? selectedCode;

    // Fetch prix ET signaux en parallèle
    const [{ data: rows }, { data: sigRows }] = await Promise.all([
      (() => {
        let q = supabase
          .from('brvm_actions_daily')
          .select('cours_jour, date_marche')
          .eq('code', selectedCode)
          .order('date_marche', { ascending: true })
          .not('cours_jour', 'is', null);
        if (dateFrom) q = q.gte('date_marche', dateFrom);
        else { const fd = periodToDate(period); if (fd) q = q.gte('date_marche', fd); }
        if (dateTo) q = q.lte('date_marche', dateTo);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('signals_daily')
          .select('signal, date_marche')
          .eq('code', selectedCode)
          .order('date_marche', { ascending: true });
        if (dateFrom) q = q.gte('date_marche', dateFrom);
        else { const fd = periodToDate(period); if (fd) q = q.gte('date_marche', fd); }
        if (dateTo) q = q.lte('date_marche', dateTo);
        return q;
      })(),
    ]);

    const priceRows = (rows ?? []) as { cours_jour: number; date_marche: string }[];
    const signalMap = new Map(
      ((sigRows ?? []) as { signal: SignalLabel; date_marche: string }[]).map((s) => [s.date_marche, s.signal])
    );

    if (priceRows.length < 2) {
      noData = true;
    } else {
      closes = priceRows.map((r) => r.cours_jour);
      dates = priceRows.map((r) => r.date_marche);
      const hasRealSignals = dates.some((d) => signalMap.has(d));
      // Use real signal when available, fallback to simpleSignal otherwise
      const signals: SignalLabel[] = dates.map((d, i) =>
        signalMap.has(d) ? signalMap.get(d)! : simpleSignal(closes)[i]!
      );
      result = runBacktest({ closes, signals, dates, feesPct, slippagePct });
      (result as BacktestResultEx).hasRealSignals = hasRealSignals;
    }
  }

  /* ── Couverture badge ─────────────────────────────────────────────────── */
  const coverageTone =
    closes.length >= 500 ? 'emerald' : closes.length >= 250 ? 'gold' : 'neutral';

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <SectionHeader
        kicker="BRVM · Simulation de stratégie"
        title="Backtest"
        subtitle="Signal momentum : variation > 2 % → ACHAT · < −2 % → VENTE · sinon CONSERVER"
      />

      <div className="gold-rule" />

      {/* Form panel */}
      <PremiumPanel>
        <form method="GET" action="" className="p-5 flex flex-wrap items-end gap-4">
          {/* Instrument */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="overline text-faint text-[10px]">Instrument</label>
            <select
              id="code"
              name="code"
              defaultValue={selectedCode}
              className={`${inputCls} min-w-[200px]`}
            >
              <option value="">— Choisir un titre —</option>
              {instrumentList.map((ins) => (
                <option key={ins.code} value={ins.code}>
                  {ins.code}{ins.designation ? ` – ${ins.designation}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dateFrom" className="overline text-faint text-[10px]">Du</label>
            <input
              id="dateFrom"
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              className={inputCls}
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dateTo" className="overline text-faint text-[10px]">Au</label>
            <input
              id="dateTo"
              type="date"
              name="dateTo"
              defaultValue={dateTo}
              className={inputCls}
            />
          </div>

          {/* Period */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="period" className="overline text-faint text-[10px]">Période (si sans dates)</label>
            <select
              id="period"
              name="period"
              defaultValue={period}
              className={inputCls}
            >
              <option value="1M">1 mois</option>
              <option value="3M">3 mois</option>
              <option value="6M">6 mois</option>
              <option value="1A">1 an</option>
              <option value="max">Max</option>
            </select>
          </div>

          {/* Frais */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fees" className="overline text-faint text-[10px]">Frais</label>
            <input
              id="fees"
              type="number"
              name="fees"
              step="0.001"
              min="0"
              max="0.1"
              defaultValue={feesPct}
              className={`${inputCls} w-24`}
            />
          </div>

          {/* Slippage */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="slippage" className="overline text-faint text-[10px]">Slippage</label>
            <input
              id="slippage"
              type="number"
              name="slippage"
              step="0.001"
              min="0"
              max="0.1"
              defaultValue={slippagePct}
              className={`${inputCls} w-24`}
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-gold text-obsidian text-sm font-semibold shadow-gold transition-all duration-200 hover:bg-gold-soft active:scale-[0.98]"
          >
            Analyser
          </button>
        </form>
      </PremiumPanel>

      {/* Empty state — no instrument selected */}
      {!selectedCode && (
        <EmptyStatePremium
          icon="◈"
          title="Sélectionnez un instrument"
          hint="Choisissez une action BRVM et configurez la période pour lancer la simulation."
        />
      )}

      {/* Empty state — no price history */}
      {selectedCode && noData && (
        <PremiumPanel>
          <div className="p-8 text-center space-y-4">
            <p className="text-muted text-sm">
              Aucun historique de cours pour{' '}
              <span className="tabular text-ivory font-semibold">{selectedCode}</span>{' '}
              sur cette période.
            </p>
            <p className="text-xs text-faint">
              Lancez le backfill dans le scraper :
            </p>
            <pre className="text-xs font-mono bg-bg border border-border rounded-lg px-4 py-3 text-up select-all inline-block">
              npm run backfill -- {selectedCode} --from=2023-01-01
            </pre>
          </div>
        </PremiumPanel>
      )}

      {/* Coverage indicator */}
      {result && closes.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-faint tabular">
            {dates[0]} → {dates[dates.length - 1]}
          </span>
          <StatPill tone={coverageTone}>
            {closes.length} séances
            {closes.length < 250 && ' · historique court'}
            {closes.length >= 250 && closes.length < 500 && ' · ~1 an'}
            {closes.length >= 500 && ' · 2+ ans'}
          </StatPill>
          {result && (
            <StatPill tone={(result as BacktestResultEx).hasRealSignals ? 'emerald' : 'neutral'}>
              {(result as BacktestResultEx).hasRealSignals
                ? 'Signaux BRVM Analyst Pro'
                : 'Signal momentum (fallback)'}
            </StatPill>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Instrument label */}
          <div className="flex items-center gap-3 flex-wrap">
            <Eyebrow>{selectedCode}</Eyebrow>
            {designation && designation !== selectedCode && (
              <span className="text-sm text-muted">{designation}</span>
            )}
            {(feesPct > 0 || slippagePct > 0) && (
              <StatPill tone="neutral">
                frais {(feesPct * 100).toFixed(2)}%
                {slippagePct > 0 ? ` · slippage ${(slippagePct * 100).toFixed(2)}%` : ''}
              </StatPill>
            )}
          </div>

          {/* Chart */}
          <PremiumPanel glow>
            <div className="p-4">
              <BacktestChart
                equityCurve={result.equityCurve}
                closes={closes}
                dates={dates}
                drawdownPeriods={result.drawdownPeriods}
              />
            </div>
          </PremiumPanel>

          {/* Metrics */}
          <BacktestMetrics result={result} />

          {/* Narrative */}
          {(() => {
            const { strengths, limits } = generateNarrative(result, selectedCode);
            return (
              <PremiumPanel>
                <div className="p-5 space-y-4">
                  <p className="overline text-gold/70 text-[10px]">Synthèse qualitative</p>
                  <div className="space-y-4 text-sm">
                    {strengths.length > 0 && (
                      <div>
                        <p className="overline text-faint text-[10px] mb-2">Points forts</p>
                        <ul className="space-y-1.5">
                          {strengths.map((s, i) => (
                            <li key={i} className="flex gap-2 items-start">
                              <span className="text-up mt-0.5 shrink-0">▸</span>
                              <span className="text-ivory">{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {limits.length > 0 && (
                      <div>
                        <p className="overline text-faint text-[10px] mb-2">Limites</p>
                        <ul className="space-y-1.5">
                          {limits.map((l, i) => (
                            <li key={i} className="flex gap-2 items-start">
                              <span className="text-muted mt-0.5 shrink-0">▸</span>
                              <span className="text-muted">{l}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-faint italic border-t border-border/50 pt-3">
                      Les résultats passés ne garantissent pas les performances futures.
                      Ce backtest est fourni à titre informatif uniquement.
                    </p>
                  </div>
                </div>
              </PremiumPanel>
            );
          })()}

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <BacktestExport
              equityCurve={result.equityCurve}
              closes={closes}
              dates={dates}
              code={selectedCode}
            />
            <a
              href="/backtest"
              className="text-xs border border-border text-muted rounded-lg px-4 py-2 hover:text-gold hover:border-gold/40 transition-all duration-200"
            >
              Tester un autre titre
            </a>
          </div>
        </>
      )}
    </div>
  );
}
