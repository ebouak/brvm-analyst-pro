import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CompareChart, { type ComparePoint, type NormMode, type PeriodKey } from '@/components/CompareChart';
import CompareSelector from '@/components/CompareSelector';
import CompareStats from '@/components/CompareStats';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import CompareFundamentals from '@/components/CompareFundamentals';
import CompareVerdict from '@/components/CompareVerdict';
import type { ActionDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';

// -- Période → nombre de séances approx --
const PERIOD_ROWS: Record<PeriodKey, number> = {
  '1M': 22,
  '3M': 66,
  '6M': 132,
  '1A': 262,
  '2A': 524,
  'MAX': 2000,
};

const PERIODS: PeriodKey[] = ['1M', '3M', '6M', '1A', '2A', 'MAX'];
const MODES: Array<{ key: NormMode; label: string }> = [
  { key: 'base100', label: 'Base 100' },
  { key: 'variation', label: 'Variation %' },
  { key: 'prix', label: 'Prix brut' },
];

// -- Data fetching --

async function getInstruments() {
  const supabase = createClient();
  const { data } = await supabase
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .order('code');
  return (data ?? []) as Array<{ code: string; designation: string | null; secteur: string | null }>;
}

async function getSeries(codes: string[], limit: number) {
  const supabase = createClient();
  const map: Record<string, ActionDaily[]> = {};
  await Promise.all(
    codes.map(async (code) => {
      const { data } = await supabase
        .from('brvm_actions_daily')
        .select(
          'date_marche,cours_jour,code,designation,cours_precedent,pays,secteur,variation_pct,volume,nb_transactions,valeur_echangee',
        )
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(limit);
      map[code] = ((data ?? []) as ActionDaily[]).reverse();
    }),
  );
  return map;
}

// -- Transform: build aligned ComparePoint[] with RAW prices (mode applied in chart) --
function buildRaw(map: Record<string, ActionDaily[]>, codes: string[]): ComparePoint[] {
  const byDate: Record<string, ComparePoint> = {};
  for (const code of codes) {
    const rows = map[code] ?? [];
    for (const r of rows) {
      if (!byDate[r.date_marche]) byDate[r.date_marche] = { date: r.date_marche };
      byDate[r.date_marche]![code] = r.cours_jour ?? null;
    }
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// -- Page --

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { codes?: string; period?: string; mode?: string };
}) {
  const codes = (searchParams.codes ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 6);

  const period: PeriodKey =
    PERIODS.includes(searchParams.period as PeriodKey)
      ? (searchParams.period as PeriodKey)
      : '6M';

  const mode: NormMode =
    (['base100', 'variation', 'prix'] as NormMode[]).includes(searchParams.mode as NormMode)
      ? (searchParams.mode as NormMode)
      : 'base100';

  const [instruments, seriesMap] = await Promise.all([
    getInstruments(),
    codes.length > 0 ? getSeries(codes, PERIOD_ROWS[period]) : Promise.resolve({}),
  ]);

  const rows = codes.length > 0 ? buildRaw(seriesMap, codes) : [];

  const meta = codes.map((code) => {
    const instr = instruments.find((i) => i.code === code);
    return { code, designation: instr?.designation ?? null };
  });

  // Load fundamentals for comparison
  const fundamentals = await Promise.all(
    codes.map(async (code) => {
      const f = await loadCompanyFinancials(code);
      if (!f) return null;
      const latestIncome = f.incomeStatements[0] ?? null;
      const prevIncome = f.incomeStatements[1] ?? null;
      const latestBalance = f.balanceSheets[0] ?? null;
      const latestCashflow = f.cashFlowStatements[0] ?? null;
      const ratios = calculateFundamentals({
        coursActuel: f.latestDaily?.cours_jour ?? null,
        shares: f.instrument.shares,
        cours_bas_52s: f.latestDaily?.cours_bas_52s ?? null,
        cours_haut_52s: f.latestDaily?.cours_haut_52s ?? null,
        income: latestIncome,
        incomePrev: prevIncome,
        balance: latestBalance,
        cashflow: latestCashflow,
      });
      // Calculate performance for the selected period
      const seriesForCode = (seriesMap as Record<string, ActionDaily[]>)[code] ?? [];
      let perfPct: number | null = null;
      if (seriesForCode.length >= 2) {
        const firstPrice = seriesForCode[0]?.cours_jour ?? null;
        const lastPrice = seriesForCode[seriesForCode.length - 1]?.cours_jour ?? null;
        if (firstPrice && lastPrice) {
          perfPct = ((lastPrice - firstPrice) / firstPrice) * 100;
        }
      }
      return {
        code,
        designation: f.instrument.designation,
        ratios,
        coursActuel: f.latestDaily?.cours_jour ?? null,
        fcf: latestCashflow?.flux_tresorerie_disponible ?? null,
        shares: f.instrument.shares,
        perfPct,
      };
    })
  );
  const fundaRows = fundamentals.filter(Boolean) as NonNullable<typeof fundamentals[number]>[];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <Link href="/actions" className="text-xs text-[#00c853]">
          ← Marché actions
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Comparateur multi-titres</h1>
        <p className="text-sm text-[#8b93a7]">
          Performance relative base 100 — jusqu'à 6 actions BRVM
        </p>
      </div>

      {/* Selector */}
      <CompareSelector
        instruments={instruments}
        selected={codes}
        period={period}
        mode={mode}
      />

      {/* Période + Mode chips */}
      <PeriodModeBar codes={codes} period={period} mode={mode} />

      {/* Chart */}
      {codes.length === 0 ? (
        <p className="text-sm text-[#8b93a7]">
          Sélectionnez 2 à 6 actions pour afficher le comparatif.
        </p>
      ) : codes.length === 1 ? (
        <p className="text-sm text-[#8b93a7]">
          Ajoutez au moins une deuxième action pour comparer.
        </p>
      ) : (
        <>
          <CompareChart data={rows} codes={codes} mode={mode} period={period} meta={meta} />
          <CompareStats rows={rows} codes={codes} meta={meta} />
          {fundaRows.length >= 2 && (
            <>
              <CompareVerdict rows={fundaRows} />
              <CompareFundamentals rows={fundaRows} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// -- Period + Mode bar (server component, links) --

function PeriodModeBar({
  codes,
  period,
  mode,
}: {
  codes: string[];
  period: PeriodKey;
  mode: NormMode;
}) {
  const base = `/actions/compare?codes=${codes.join(',')}&`;

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {/* Période */}
      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`${base}period=${p}&mode=${mode}`}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              p === period
                ? 'bg-[#00c853] text-black'
                : 'bg-[#161922] text-[#8b93a7] border border-[#232733] hover:border-[#42a5f5]'
            }`}
          >
            {p}
          </Link>
        ))}
      </div>

      <div className="w-px h-5 bg-[#232733]" />

      {/* Mode */}
      <div className="flex gap-1">
        {MODES.map(({ key, label }) => (
          <Link
            key={key}
            href={`${base}period=${period}&mode=${key}`}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              key === mode
                ? 'bg-[#42a5f5] text-black'
                : 'bg-[#161922] text-[#8b93a7] border border-[#232733] hover:border-[#42a5f5]'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
