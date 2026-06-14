import { createClient } from '@/lib/supabase/server';
import { runBacktest, type BacktestResult } from '@/lib/backtest';
import { synthesizeBacktest, type BenchmarkSet } from '@/lib/backtest/interpret';
import type { SignalLabel } from '@/lib/types';
import BacktestChart from '@/components/BacktestChart';
import BacktestMetrics from '@/components/BacktestMetrics';
import BacktestSynthesis from '@/components/BacktestSynthesis';
import BacktestTrades from '@/components/BacktestTrades';
import BacktestExport from '@/components/BacktestExport';
import { BacktestInfographic } from '@/components/backtest/backtest-infographic';
import { ShareableInfographic } from '@/components/backtest/share-button';
import { toBacktestReport } from '@/lib/backtest-adapter';
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

/** Taux sans risque annuel de référence (obligations d'État UEMOA ~6 %). */
const RISK_FREE_RATE = 0.06;

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
  let benchmarks: BenchmarkSet = { buyHoldReturn: 0, indexReturn: null, riskFreeReturn: 0 };

  if (selectedCode) {
    designation =
      instrumentList.find((i) => i.code === selectedCode)?.designation ?? selectedCode;

    // Fetch prix, signaux ET indice de marché (BRVM-C) en parallèle
    const fromDate = dateFrom || periodToDate(period) || null;
    const [{ data: rows }, { data: sigRows }, { data: idxRows }] = await Promise.all([
      (() => {
        let q = supabase
          .from('brvm_actions_daily')
          .select('cours_jour, date_marche')
          .eq('code', selectedCode)
          .order('date_marche', { ascending: true })
          .not('cours_jour', 'is', null);
        if (fromDate) q = q.gte('date_marche', fromDate);
        if (dateTo) q = q.lte('date_marche', dateTo);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('signals_daily')
          .select('signal, date_marche')
          .eq('code', selectedCode)
          .order('date_marche', { ascending: true });
        if (fromDate) q = q.gte('date_marche', fromDate);
        if (dateTo) q = q.lte('date_marche', dateTo);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('brvm_indices_daily')
          .select('valeur, date_marche')
          .eq('code', 'BRVMC')
          .order('date_marche', { ascending: true })
          .not('valeur', 'is', null);
        if (fromDate) q = q.gte('date_marche', fromDate);
        if (dateTo) q = q.lte('date_marche', dateTo);
        return q;
      })(),
    ]);

    const priceRows = (rows ?? []) as { cours_jour: number; date_marche: string }[];
    const VALID_SIGNALS = new Set(['BUY', 'HOLD', 'SELL']);
    const signalMap = new Map(
      (sigRows ?? [])
        .filter((s): s is { signal: SignalLabel; date_marche: string } => VALID_SIGNALS.has((s as { signal: string }).signal))
        .map((s) => [s.date_marche, s.signal])
    );

    if (priceRows.length < 2) {
      noData = true;
    } else {
      closes = priceRows.map((r) => r.cours_jour);
      dates = priceRows.map((r) => r.date_marche);
      const hasRealSignals = dates.some((d) => signalMap.has(d));
      // Use real signal when available, fallback to simpleSignal otherwise
      const fallback = simpleSignal(closes);
      const signals: SignalLabel[] = dates.map((d, i) =>
        signalMap.get(d) ?? fallback[i]!
      );
      result = { ...runBacktest({ closes, signals, dates, feesPct, slippagePct, riskFreeRate: RISK_FREE_RATE }), hasRealSignals };

      // Benchmarks : rendement BRVM-C sur la fenêtre + sans-risque dérivé.
      const idxValues = ((idxRows ?? []) as { valeur: number }[]).map((r) => r.valeur).filter((v) => v != null && v > 0);
      const indexReturn = idxValues.length >= 2 ? (idxValues[idxValues.length - 1]! - idxValues[0]!) / idxValues[0]! : null;
      const riskFreeReturn = Math.pow(1 + RISK_FREE_RATE, closes.length / 252) - 1;
      benchmarks = { buyHoldReturn: result.buyAndHoldReturn, indexReturn, riskFreeReturn };
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
              L&apos;historique de cette valeur s&apos;étoffe automatiquement séance après séance —
              choisissez une période plus courte ou une autre valeur en attendant.
            </p>
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
            <StatPill tone={result.hasRealSignals ? 'emerald' : 'neutral'}>
              {result.hasRealSignals
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

          {/* Synthèse + comparaison aux repères */}
          <BacktestSynthesis
            synthesis={synthesizeBacktest(result, benchmarks, closes.length)}
            strategyReturn={result.totalReturn}
            benchmarks={benchmarks}
          />

          {/* Chart avec marqueurs BUY/SELL */}
          <PremiumPanel glow>
            <div className="p-4">
              <BacktestChart
                equityCurve={result.equityCurve}
                closes={closes}
                dates={dates}
                drawdownPeriods={result.drawdownPeriods}
                trades={result.trades}
              />
            </div>
          </PremiumPanel>

          {/* Métriques pédagogiques */}
          <BacktestMetrics result={result} />

          {/* Détail des trades */}
          <BacktestTrades
            trades={result.trades}
            bestTradePct={result.bestTradePct}
            worstTradePct={result.worstTradePct}
          />

          {/* Fiche partageable (infographie claire, exportable en image) */}
          {(() => {
            const PERIOD_LABEL: Record<Period, string> = {
              '1M': '1 mois', '3M': '3 mois', '6M': '6 mois', '1A': '1 an', 'max': 'historique complet',
            };
            const report = toBacktestReport({
              code: selectedCode,
              designation: designation || selectedCode,
              result,
              benchmarks,
              synthesis: synthesizeBacktest(result, benchmarks, closes.length),
              dates,
              feesPct,
              periodLabel: PERIOD_LABEL[period],
            });
            return (
              <div>
                <Eyebrow className="mb-3">Fiche partageable</Eyebrow>
                <ShareableInfographic filename={`backtest-${selectedCode}`}>
                  <BacktestInfographic report={report} variant="full" />
                </ShareableInfographic>
              </div>
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
