import { createClient } from '@/lib/supabase/server';
import { runBacktest, type BacktestResult } from '@/lib/backtest';
import type { SignalLabel } from '@/lib/types';
import BacktestChart from '@/components/BacktestChart';
import BacktestMetrics from '@/components/BacktestMetrics';

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
    const variationPct = ((c - closes[i - 1]) / closes[i - 1]) * 100;
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
  searchParams: { code?: string; period?: string };
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

  let result: BacktestResult | null = null;
  let designation = '';
  let noData = false;
  let closes: number[] = [];

  if (selectedCode) {
    designation =
      instrumentList.find((i) => i.code === selectedCode)?.designation ?? selectedCode;

    let query = supabase
      .from('brvm_actions_daily')
      .select('cours_jour, date_marche')
      .eq('code', selectedCode)
      .order('date_marche', { ascending: true })
      .not('cours_jour', 'is', null);

    const fromDate = periodToDate(period);
    if (fromDate) {
      query = query.gte('date_marche', fromDate);
    }

    const { data: rows } = await query;
    const priceRows = (rows ?? []) as { cours_jour: number; date_marche: string }[];

    if (priceRows.length < 2) {
      noData = true;
    } else {
      closes = priceRows.map((r) => r.cours_jour);
      const signals = simpleSignal(closes);
      result = runBacktest({ closes, signals });
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

        <div className="flex flex-col gap-1">
          <label htmlFor="period" className="text-xs text-muted">Période</label>
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
          Aucun historique de cours disponible pour <span className="tabular text-white">{selectedCode}</span> sur cette période.
        </div>
      )}

      {result && (
        <>
          <p className="text-sm text-muted">
            Instrument : <span className="text-white">{selectedCode}</span>
            {designation && designation !== selectedCode && (
              <> — <span className="text-white">{designation}</span></>
            )}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BacktestChart
                equityCurve={result.equityCurve}
                closes={closes}
              />
            </div>
            <BacktestMetrics result={result} />
          </div>
        </>
      )}
    </div>
  );
}
