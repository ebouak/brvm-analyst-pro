import { createClient } from '@/lib/supabase/server';
import DividendsTable from '@/components/DividendsTable';
import DividendsTopCard from '@/components/DividendsTopCard';
import { computeYield, groupByYear, type DividendRow } from '@/lib/dividends';
import { fmtFcfa, fmtDateFR } from '@/lib/format';
import { TrendingUp, Activity, BarChart3 } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dividendes — BRVM Analyst Pro' };

interface RawDividend {
  id: string;
  code: string;
  exercice: number | null;
  ex_date: string | null;
  payment_date: string | null;
  montant: number;
  devise: string;
}

interface RawInstrument {
  code: string;
  designation: string | null;
  secteur: string | null;
  pays: string | null;
}

interface RawAction {
  code: string;
  cours_jour: number | null;
}

async function getData(year?: string, sector?: string): Promise<{
  rows: DividendRow[];
  years: number[];
  sectors: string[];
  top5Yield: DividendRow[];
  upcoming: DividendRow[];
  byYear: { exercice: number; total: number }[];
}> {
  const supabase = createClient();

  const [{ data: divData }, { data: instrData }] = await Promise.all([
    supabase
      .from('dividends')
      .select('id, code, exercice, ex_date, payment_date, montant, devise')
      .order('ex_date', { ascending: false })
      .limit(500),
    supabase
      .from('brvm_instruments')
      .select('code, designation, secteur, pays'),
  ]);

  const dividends = (divData ?? []) as RawDividend[];
  const instruments = (instrData ?? []) as RawInstrument[];

  const instrByCode = new Map<string, RawInstrument>();
  for (const ins of instruments) instrByCode.set(ins.code, ins);

  const divCodes = [...new Set(dividends.map((d) => d.code))];

  let coursByCode = new Map<string, number | null>();
  if (divCodes.length > 0) {
    const { data: lastActRow } = await supabase
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1);
    const lastDate = lastActRow?.[0]?.date_marche ?? null;
    if (lastDate) {
      const { data: acts } = await supabase
        .from('brvm_actions_daily')
        .select('code, cours_jour')
        .eq('date_marche', lastDate)
        .in('code', divCodes);
      for (const a of (acts ?? []) as RawAction[]) {
        coursByCode.set(a.code, a.cours_jour);
      }
    }
  }

  const rows: DividendRow[] = dividends.map((d) => {
    const ins = instrByCode.get(d.code);
    const cours = coursByCode.get(d.code) ?? null;
    return {
      id: d.id,
      code: d.code,
      designation: ins?.designation ?? null,
      secteur: ins?.secteur ?? null,
      pays: ins?.pays ?? null,
      exercice: d.exercice,
      ex_date: d.ex_date,
      payment_date: d.payment_date,
      montant: d.montant,
      cours_jour: cours,
      rendement_pct: computeYield(d.montant, cours),
    };
  });

  // Unique sorted years and sectors
  const years = [...new Set(rows.map((r) => r.exercice).filter((y): y is number => y != null))].sort((a, b) => b - a);
  const sectors = [...new Set(rows.map((r) => r.secteur).filter((s): s is string => s != null))].sort();

  // Apply SSR filters
  let filtered = rows;
  if (year) filtered = filtered.filter((r) => String(r.exercice) === year);
  if (sector) filtered = filtered.filter((r) => r.secteur === sector);

  // Top 5 by yield (rendement non-null, all rows)
  const top5Yield = [...rows]
    .filter((r) => r.rendement_pct != null)
    .sort((a, b) => (b.rendement_pct ?? 0) - (a.rendement_pct ?? 0))
    .slice(0, 5);

  // Upcoming: payment_date >= today
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...rows]
    .filter((r) => r.payment_date != null && r.payment_date >= today)
    .sort((a, b) => (a.payment_date ?? '').localeCompare(b.payment_date ?? ''))
    .slice(0, 5);

  // Group by year (last 5 years)
  const yearMap = groupByYear(rows);
  const currentYear = new Date().getFullYear();
  const byYear = Array.from(yearMap.entries())
    .filter(([y]) => y >= currentYear - 4)
    .sort(([a], [b]) => a - b)
    .map(([exercice, total]) => ({ exercice, total }));

  return { rows: filtered, years, sectors, top5Yield, upcoming, byYear };
}

interface PageProps {
  searchParams: { year?: string; sector?: string };
}

export default async function DividendesPage({ searchParams }: PageProps) {
  const year = typeof searchParams.year === 'string' ? searchParams.year : undefined;
  const sector = typeof searchParams.sector === 'string' ? searchParams.sector : undefined;

  const { rows, years, sectors, top5Yield, upcoming, byYear } = await getData(year, sector);

  const top5Entries = top5Yield.map((r) => ({
    code: r.code,
    label: r.designation ?? '',
    value: r.rendement_pct != null ? `${r.rendement_pct.toFixed(2)}%` : '—',
    sub: fmtFcfa(r.montant) + ' FCFA',
  }));

  const upcomingEntries = upcoming.map((r) => ({
    code: r.code,
    label: r.designation ?? '',
    value: fmtDateFR(r.payment_date),
    sub: fmtFcfa(r.montant) + ' FCFA',
  }));

  // Max total for inline bar scaling
  const maxTotal = byYear.length > 0 ? Math.max(...byYear.map((b) => b.total)) : 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Dividendes BRVM</h1>
          <p className="text-xs text-muted mt-1">
            Historique des dividendes distribués · rendement calculé sur dernier cours disponible
          </p>
        </div>
        <span className="text-xs text-muted tabular">{rows.length} enregistrement{rows.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DividendsTopCard
          title="Top 5 rendements"
          icon={<TrendingUp size={14} />}
          entries={top5Entries}
        />
        <DividendsTopCard
          title="Prochains paiements"
          icon={<Activity size={14} />}
          entries={upcomingEntries}
        />

        {/* Inline bar chart by year */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-up"><BarChart3 size={14} /></span>
            Dividendes par exercice
          </div>
          {byYear.length === 0 ? (
            <p className="text-xs text-muted">Aucune donnée disponible.</p>
          ) : (
            <ul className="space-y-2">
              {byYear.map((b) => (
                <li key={b.exercice} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">{b.exercice}</span>
                    <span className="tabular text-white">{fmtFcfa(b.total)} FCFA</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-up/70 rounded-full"
                      style={{ width: `${Math.round((b.total / maxTotal) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main table */}
      {rows.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">
          Aucun dividende enregistré. Lancez le scraper pour alimenter la base.
        </div>
      ) : (
        <DividendsTable rows={rows} years={years} sectors={sectors} />
      )}
    </div>
  );
}
