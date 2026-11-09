import type React from 'react';
import { createClient } from '@/lib/supabase/server';
import DividendsTable from '@/components/DividendsTable';
import DividendsTopCard from '@/components/DividendsTopCard';
import ViewTabs from '@/components/ViewTabs';
import { REVENUS_TABS } from '@/lib/viewTabsPresets';
import { computeYield, type DividendRow } from '@/lib/dividends';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import { TrendingUp, BarChart3 } from '@/components/icons';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  EmptyStatePremium,
  StatPill,
  Eyebrow,
} from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dividendes' };

// Dividende par action : jamais arrondi en « k » (1 500 FCFA ≠ « 2 k »).
const fmtMontant = (n: number) => fmtNumber(n, Number.isInteger(n) ? 0 : 2);

interface UpcomingEvent {
  key: string;
  code: string;
  designation: string | null;
  date: string;
  type: 'Détachement' | 'Paiement';
  montant: number;
  base: 'brut' | 'net' | 'inconnu' | null;
}

const fmtDateLongue = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

interface RawDividend {
  id: string;
  code: string;
  exercice: number | null;
  ex_date: string | null;
  payment_date: string | null;
  montant: number;
  devise: string;
  base_fiscale: 'brut' | 'net' | 'inconnu' | null;
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
  upcoming: UpcomingEvent[];
  byYear: { exercice: number; societes: number }[];
  exerciceRecent: number | null;
  nbDistributeurs: number | null;
}> {
  const supabase = createClient();

  const [{ data: divData }, { data: instrData }] = await Promise.all([
    supabase
      .from('dividends')
      .select('id, code, exercice, ex_date, payment_date, montant, devise, base_fiscale')
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
      base_fiscale: d.base_fiscale,
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

  // À venir : détachements et paiements postérieurs à aujourd'hui (données déjà chargées).
  const today = new Date().toISOString().slice(0, 10);
  const upcoming: UpcomingEvent[] = [];
  for (const r of rows) {
    if (!(r.montant > 0)) continue;
    const ev = (date: string | null, type: UpcomingEvent['type']) => {
      if (date != null && date >= today) {
        upcoming.push({ key: `${r.id}-${type}`, code: r.code, designation: r.designation, date, type, montant: r.montant, base: r.base_fiscale ?? null });
      }
    };
    ev(r.ex_date, 'Détachement');
    ev(r.payment_date, 'Paiement');
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));

  // Par exercice (5 dernières années) : NOMBRE de sociétés ayant distribué (montant > 0).
  // Une somme de dividendes PAR ACTION de sociétés différentes n'a pas de sens
  // économique et ne se recoupe avec aucune source (critique it.6, 2026-11-08) ;
  // ce compte, lui, se vérifie contre le calendrier BRVM et Sika (36 pour 2025).
  const currentYear = new Date().getFullYear();
  const parExercice = new Map<number, Set<string>>();
  for (const r of rows) {
    if (r.exercice == null || r.exercice < currentYear - 4 || !(r.montant > 0)) continue;
    if (!parExercice.has(r.exercice)) parExercice.set(r.exercice, new Set());
    parExercice.get(r.exercice)!.add(r.code);
  }
  const byYear = Array.from(parExercice.entries())
    .sort(([a], [b]) => a - b)
    .map(([exercice, codes]) => ({ exercice, societes: codes.size }));

  // Sociétés ayant distribué (montant > 0) sur l'exercice le plus récent des 5 dernières années.
  const exerciceRecent = byYear.length > 0 ? byYear[byYear.length - 1].exercice : null;
  const nbDistributeurs = exerciceRecent == null
    ? null
    : new Set(rows.filter((r) => r.exercice === exerciceRecent && r.montant > 0).map((r) => r.code)).size;

  return { rows: filtered, years, sectors, top5Yield, upcoming, byYear, exerciceRecent, nbDistributeurs };
}

interface PageProps {
  searchParams: { year?: string; sector?: string };
}

export default async function DividendesPage({ searchParams }: PageProps) {
  const year = typeof searchParams.year === 'string' ? searchParams.year : undefined;
  const sector = typeof searchParams.sector === 'string' ? searchParams.sector : undefined;

  const { rows, years, sectors, top5Yield, upcoming, byYear, exerciceRecent, nbDistributeurs } = await getData(year, sector);

  const top5Entries = top5Yield.map((r) => ({
    code: r.code,
    label: r.designation ?? '',
    value: r.rendement_pct != null && r.montant > 0 ? `${fmtNumber(r.rendement_pct, 2)} %` : '—',
    sub: fmtMontant(r.montant) + ' FCFA',
  }));

  // Max total for inline bar scaling
  const maxTotal = byYear.length > 0 ? Math.max(...byYear.map((b) => b.societes)) : 1;

  // KPIs synthèse
  const avgYield = (() => {
    const vals = top5Yield.map((r) => r.rendement_pct).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* En-tête premium */}
      <SectionHeader
        accent="emerald"
        title="Dividendes BRVM"
        subtitle="Historique des distributions. Le rendement est calculé sur le dernier cours disponible, à partir du dividende tel que publié (net ou brut selon la source)."
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label={exerciceRecent ? `Sociétés ayant distribué (ex. ${exerciceRecent})` : 'Sociétés ayant distribué'}
          value={nbDistributeurs != null && nbDistributeurs > 0 ? String(nbDistributeurs) : '—'}
          accent="gold"
        />
        <MetricCard
          label="Meilleur rendement (%)"
          value={top5Yield[0]?.rendement_pct != null ? fmtNumber(top5Yield[0].rendement_pct, 2) : '—'}
          accent="emerald"
        />
        <MetricCard
          label="Rendement moyen top 5 (%)"
          value={avgYield != null ? fmtNumber(avgYield, 2) : '—'}
          accent="sapphire"
        />
      </div>

      {/* À venir : prochains détachements et paiements */}
      {upcoming.length === 0 ? (
        <EmptyStatePremium
          icon="◎"
          title="Aucun détachement ni paiement à venir"
          hint="Aucune date postérieure à aujourd’hui dans les distributions enregistrées."
        />
      ) : (
        <PremiumPanel glow>
          <div className="p-5">
            <h2 className="font-display text-lg text-ivory mb-3">À venir</h2>
            <ul className="divide-y divide-border/40">
              {upcoming.map((e) => (
                <li key={e.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="min-w-0 flex items-baseline gap-2">
                    <span className="font-mono font-medium text-ivory">{e.code}</span>
                    <span className="truncate text-xs text-muted">{e.designation ?? ''}</span>
                  </span>
                  <span className="flex items-baseline gap-4">
                    <span className="text-xs text-muted">{e.type}</span>
                    <span className="text-ivory">{fmtDateLongue(e.date)}</span>
                    <span className="tabular text-ivory font-semibold">
                      {fmtMontant(e.montant)} FCFA
                      <span className="ml-1 text-xs font-normal text-muted">
                        {e.base === 'net' ? 'net' : e.base === 'brut' ? 'brut' : 'publié'}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </PremiumPanel>
      )}

      {/* Top rendements · évolution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PremiumPanel>
          <div className="p-5">
            <DividendsTopCard
              title="Top 5 rendements"
              icon={<TrendingUp size={14} />}
              entries={top5Entries}
            />
          </div>
        </PremiumPanel>

        {/* Évolution par exercice */}
        <PremiumPanel>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-muted"><BarChart3 size={14} /></span>
              <Eyebrow>Sociétés ayant distribué, par exercice</Eyebrow>
            </div>
            {byYear.length === 0 ? (
              <p className="text-xs text-muted">Aucune donnée disponible.</p>
            ) : (
              <ul className="space-y-3">
                {byYear.map((b) => (
                  <li key={b.exercice} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">{b.exercice}</span>
                      <span className="tabular text-ivory">{b.societes} société{b.societes > 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent/60 rounded-full"
                        style={{ '--bar-w': `${Math.round((b.societes / maxTotal) * 100)}%`, width: 'var(--bar-w)' } as React.CSSProperties}
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
            <p className="overline text-muted mb-4">Historique des distributions</p>
            <DividendsTable rows={rows} years={years} sectors={sectors} />
          </div>
        </PremiumPanel>
      )}
    </div>
  );
}
