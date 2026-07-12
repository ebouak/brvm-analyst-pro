import type React from 'react';
import { createClient } from '@/lib/supabase/server';
import DividendsTable from '@/components/DividendsTable';
import DividendsTopCard from '@/components/DividendsTopCard';
import ViewTabs from '@/components/ViewTabs';
import { REVENUS_TABS } from '@/lib/viewTabsPresets';
import { computeYield, groupByYear, type DividendRow } from '@/lib/dividends';
import { fmtFcfa, fmtDateFR } from '@/lib/format';
import { TrendingUp, Activity, BarChart3 } from '@/components/icons';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  EmptyStatePremium,
  StatPill,
  Eyebrow,
} from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dividendes — WESTBOURSE' };

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

  // KPIs synthèse
  const avgYield = (() => {
    const vals = top5Yield.map((r) => r.rendement_pct).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();
  const totalDistrib = byYear.length > 0 ? byYear[byYear.length - 1]?.total ?? null : null;
  const lastExercice = byYear.length > 0 ? byYear[byYear.length - 1]?.exercice ?? null : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* En-tête premium */}
      <SectionHeader
        accent="emerald"
        kicker="Rémunération de l'actionnaire"
        title="Dividendes BRVM"
        subtitle="Historique des distributions · rendement calculé sur dernier cours disponible"
        actions={
          <StatPill tone="neutral">
            <span className="tabular">{rows.length}</span>&nbsp;enregistrement{rows.length !== 1 ? 's' : ''}
          </StatPill>
        }
      />
      <ViewTabs tabs={REVENUS_TABS} current="/dividendes" />

      {/* Séparateur doré */}
      <div className="h-px bg-gold-line" />

      {/* KPI cards de synthèse */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Émetteurs actifs"
          value={String(new Set(top5Yield.map((r) => r.code)).size || '—')}
          accent="gold"
        />
        <MetricCard
          label="Meilleur rendement"
          value={top5Yield[0]?.rendement_pct != null ? `${top5Yield[0].rendement_pct.toFixed(2)}%` : '—'}
          accent="emerald"
        />
        <MetricCard
          label="Rendement moy. Top 5"
          value={avgYield != null ? `${avgYield.toFixed(2)}%` : '—'}
          accent="sapphire"
        />
        <MetricCard
          label={lastExercice ? `Total distribué ${lastExercice}` : 'Dernière année'}
          value={totalDistrib != null ? fmtFcfa(totalDistrib) : '—'}
          unit="FCFA"
          accent="neutral"
        />
      </div>

      {/* Cartes résumé (top rendements · prochains paiements · évolution) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top 5 rendements */}
        <PremiumPanel glow>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-gold"><TrendingUp size={14} /></span>
              <Eyebrow>Top 5 rendements</Eyebrow>
            </div>
            <DividendsTopCard
              title="Top 5 rendements"
              icon={<TrendingUp size={14} />}
              entries={top5Entries}
            />
          </div>
        </PremiumPanel>

        {/* Prochains paiements */}
        <PremiumPanel>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sapphire"><Activity size={14} /></span>
              <Eyebrow className="text-sapphire/70">Prochains paiements</Eyebrow>
            </div>
            <DividendsTopCard
              title="Prochains paiements"
              icon={<Activity size={14} />}
              entries={upcomingEntries}
            />
          </div>
        </PremiumPanel>

        {/* Évolution par exercice */}
        <PremiumPanel>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-up"><BarChart3 size={14} /></span>
              <Eyebrow className="text-up/70">Dividendes par exercice</Eyebrow>
            </div>
            {byYear.length === 0 ? (
              <p className="text-xs text-muted">Aucune donnée disponible.</p>
            ) : (
              <ul className="space-y-3">
                {byYear.map((b) => (
                  <li key={b.exercice} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">{b.exercice}</span>
                      <span className="tabular text-ivory">{fmtFcfa(b.total)} FCFA</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-up/60 rounded-full transition-all duration-500"
                        style={{ '--bar-w': `${Math.round((b.total / maxTotal) * 100)}%`, width: 'var(--bar-w)' } as React.CSSProperties}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PremiumPanel>
      </div>

      {/* Tableau principal */}
      {rows.length === 0 ? (
        <EmptyStatePremium
          icon="◎"
          title="Aucun dividende enregistré"
          hint="Lancez le scraper pour alimenter la base avec les distributions récentes."
        />
      ) : (
        <PremiumPanel>
          <div className="p-5">
            <p className="overline text-faint mb-4">Historique des distributions</p>
            <DividendsTable rows={rows} years={years} sectors={sectors} />
          </div>
        </PremiumPanel>
      )}
    </div>
  );
}
