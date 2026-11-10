import type React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DividendsTable from '@/components/DividendsTable';
import ViewTabs from '@/components/ViewTabs';
import { REVENUS_TABS } from '@/lib/viewTabsPresets';
import { computeYield, type DividendRow } from '@/lib/dividends';
import { meilleursRendements } from '@/lib/dividendes/classement';
import { fmtDateCourte, fmtNumber } from '@/lib/format';
import { EmptyStatePremium, PremiumPanel } from '@/components/ui/premium';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { SommaireChapitres } from '@/components/marche/SommaireChapitres';
import { LigneSource } from '@/components/marche/LigneSource';
import { Chapitre } from '@/components/fiche/Chapitre';

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

const fmtJour = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtAnnee = (iso: string) => iso.slice(0, 4);

const libelleBase = (b: UpcomingEvent['base']) => (b === 'net' ? 'net' : b === 'brut' ? 'brut' : 'publié');

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
  classement: DividendRow[];
  upcoming: UpcomingEvent[];
  byYear: { exercice: number; societes: number }[];
  exerciceRecent: number | null;
  nbDistributeurs: number | null;
  dateCours: string | null;
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

  const coursByCode = new Map<string, number | null>();
  let dateCours: string | null = null;
  if (divCodes.length > 0) {
    const { data: lastActRow } = await supabase
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1);
    dateCours = lastActRow?.[0]?.date_marche ?? null;
    if (dateCours) {
      const { data: acts } = await supabase
        .from('brvm_actions_daily')
        .select('code, cours_jour')
        .eq('date_marche', dateCours)
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

  const years = [...new Set(rows.map((r) => r.exercice).filter((y): y is number => y != null))].sort((a, b) => b - a);
  const sectors = [...new Set(rows.map((r) => r.secteur).filter((s): s is string => s != null))].sort();

  let filtered = rows;
  if (year) filtered = filtered.filter((r) => String(r.exercice) === year);
  if (sector) filtered = filtered.filter((r) => r.secteur === sector);

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

  const exerciceRecent = byYear.length > 0 ? byYear[byYear.length - 1].exercice : null;
  const nbDistributeurs = exerciceRecent == null
    ? null
    : (byYear.find((b) => b.exercice === exerciceRecent)?.societes ?? null);

  // Rendements : dernier exercice seulement (voir lib/dividendes/classement.ts).
  const classement = meilleursRendements(rows, exerciceRecent, 5);

  return { rows: filtered, years, sectors, classement, upcoming, byYear, exerciceRecent, nbDistributeurs, dateCours };
}

interface PageProps {
  searchParams: { year?: string; sector?: string };
}

export default async function DividendesPage({ searchParams }: PageProps) {
  const year = typeof searchParams.year === 'string' ? searchParams.year : undefined;
  const sector = typeof searchParams.sector === 'string' ? searchParams.sector : undefined;

  const { rows, years, sectors, classement, upcoming, byYear, exerciceRecent, nbDistributeurs, dateCours } =
    await getData(year, sector);

  const maxSocietes = byYear.length > 0 ? Math.max(...byYear.map((b) => b.societes)) : 1;
  const maxRdt = classement[0]?.rendement_pct ?? 1;

  const chapitres = [
    { id: 'a-venir', label: 'Prochaines dates' },
    ...(classement.length > 0 ? [{ id: 'rendements', label: 'Rendements' }] : []),
    ...(byYear.length > 0 ? [{ id: 'par-exercice', label: 'Par exercice' }] : []),
    { id: 'historique', label: 'Historique' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <EnTeteCote
        titre="Dividendes"
        description="Les prochaines dates de détachement et de paiement, les rendements du dernier exercice et l’historique des distributions."
        seance={dateCours}
        libelleSeance="Cours du"
        compte={
          nbDistributeurs != null && nbDistributeurs > 0 && exerciceRecent != null
            ? { n: nbDistributeurs, libelle: `sociétés ayant distribué pour ${exerciceRecent}` }
            : null
        }
        source={null}
      />
      <div className="mt-6">
        <ViewTabs tabs={REVENUS_TABS} current="/dividendes" />
      </div>
      <SommaireChapitres chapitres={chapitres} />

      {/* ── 01 : Prochaines dates ─────────────────────────────────────────── */}
      <section aria-labelledby="a-venir-titre">
        <Chapitre
          id="a-venir"
          numero="01"
          titre="Prochaines dates"
          sousTitre="Détachements et paiements annoncés, du plus proche au plus lointain."
          premier
        />
        <div className="mt-6">
          {upcoming.length === 0 ? (
            <EmptyStatePremium
              title="Aucune date annoncée"
              hint="Aucun détachement ni paiement postérieur à aujourd’hui dans les distributions enregistrées."
              action={{ href: '/dividendes/calendrier', label: 'Voir le calendrier' }}
            />
          ) : (
            <PremiumPanel>
              <ol className="divide-y divide-border/50">
                {upcoming.map((e) => (
                  <li
                    key={e.key}
                    className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 px-4 py-3 md:grid-cols-[88px_120px_minmax(0,1fr)_auto] md:px-5"
                  >
                    <time dateTime={e.date} className="row-span-2 md:row-span-1">
                      <span className="block tabular text-base text-ivory">{fmtJour(e.date)}</span>
                      <span className="block tabular text-xs text-faint">{fmtAnnee(e.date)}</span>
                    </time>
                    <span className="col-start-2 row-start-2 text-xs text-muted md:col-start-2 md:row-start-1 md:text-sm">
                      {e.type}
                    </span>
                    <span className="col-start-2 row-start-1 min-w-0 truncate md:col-start-3">
                      <Link
                        href={`/actions/${e.code}`}
                        className="rounded font-mono font-medium text-ivory transition-colors hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {e.code}
                      </Link>
                      <span className="ml-2 text-xs text-muted">{e.designation ?? ''}</span>
                    </span>
                    <span className="col-start-3 row-span-2 text-right md:col-start-4 md:row-span-1">
                      <span className="tabular text-ivory">{fmtMontant(e.montant)}</span>
                      <span className="ml-1 text-xs text-muted">FCFA {libelleBase(e.base)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </PremiumPanel>
          )}
          <LigneSource>
            Dates du calendrier officiel des dividendes de la BRVM et du Bulletin officiel de la cote, à défaut
            des sources publiques. Montant par action, net ou brut selon ce que la source publie.{' '}
            <Link href="/dividendes/calendrier" className="underline underline-offset-2 hover:text-muted">
              Calendrier complet
            </Link>
          </LigneSource>
        </div>
      </section>

      {/* ── 02 : Rendements du dernier exercice ───────────────────────────── */}
      {classement.length > 0 && exerciceRecent != null && (
        <section aria-labelledby="rendements-titre">
          <Chapitre
            id="rendements"
            numero="02"
            titre={`Les rendements de l’exercice ${exerciceRecent}`}
            sousTitre="Les cinq dividendes les plus élevés rapportés au cours actuel de l’action."
          />
          <div className="mt-6">
            <PremiumPanel>
              <ol className="divide-y divide-border/50">
                {classement.map((r, i) => {
                  const pct = r.rendement_pct ?? 0;
                  return (
                    <li key={r.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3.5 md:px-5">
                      <span className="tabular text-sm text-faint">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <Link
                            href={`/actions/${r.code}`}
                            className="rounded font-mono font-medium text-ivory transition-colors hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            {r.code}
                          </Link>
                          <span className="truncate text-xs text-muted">{r.designation ?? ''}</span>
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60" aria-hidden>
                          <div
                            className="h-full rounded-full bg-accent/70"
                            style={{ width: `${Math.max(2, Math.round((pct / maxRdt) * 100))}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block tabular text-xl text-ivory">{fmtNumber(pct, 2)} %</span>
                        <span className="block tabular text-xs text-muted">{fmtMontant(r.montant)} FCFA</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </PremiumPanel>
            <LigneSource>
              Dividende de l’exercice {exerciceRecent} divisé par le cours de clôture
              {dateCours ? <> du <time dateTime={dateCours}>{fmtDateCourte(dateCours)}</time></> : null}. Un dividende
              d’un exercice plus ancien n’entre pas dans ce classement : le rapporter au cours d’aujourd’hui ne
              mesurerait rien.
            </LigneSource>
          </div>
        </section>
      )}

      {/* ── 03 : Sociétés ayant distribué, par exercice ───────────────────── */}
      {byYear.length > 0 && (
        <section aria-labelledby="par-exercice-titre">
          <Chapitre
            id="par-exercice"
            numero={classement.length > 0 ? '03' : '02'}
            titre="Combien de sociétés distribuent"
            sousTitre="Nombre de sociétés cotées ayant versé un dividende, par exercice."
          />
          <div className="mt-6">
            <PremiumPanel>
              <ul className="space-y-4 px-4 py-5 md:px-5">
                {byYear.map((b) => (
                  <li key={b.exercice} className="grid grid-cols-[48px_minmax(0,1fr)_96px] items-center gap-x-4">
                    <span className="tabular text-sm text-muted">{b.exercice}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-border/60" aria-hidden>
                      <div
                        className={`h-full rounded-full ${b.exercice === exerciceRecent ? 'bg-accent' : 'bg-accent/40'}`}
                        style={{ width: `${Math.round((b.societes / maxSocietes) * 100)}%` } as React.CSSProperties}
                      />
                    </div>
                    <span className="text-right text-sm">
                      <span className="tabular text-ivory">{b.societes}</span>
                      <span className="ml-1 text-xs text-muted">société{b.societes > 1 ? 's' : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </PremiumPanel>
            <LigneSource>
              Une société est comptée si au moins un dividende non nul est enregistré pour l’exercice. Un exercice en
              cours peut encore évoluer jusqu’aux assemblées générales.
            </LigneSource>
          </div>
        </section>
      )}

      {/* ── Historique ────────────────────────────────────────────────────── */}
      <section aria-labelledby="historique-titre">
        <Chapitre
          id="historique"
          numero={String(chapitres.length).padStart(2, '0')}
          titre="Historique des distributions"
          sousTitre="Toutes les distributions enregistrées, filtrables par exercice et par secteur."
        />
        <div className="mt-6">
          {rows.length === 0 ? (
            <EmptyStatePremium
              title="Aucun dividende enregistré"
              hint="L’historique s’affichera dès que des distributions auront été collectées."
            />
          ) : (
            <DividendsTable rows={rows} years={years} sectors={sectors} />
          )}
        </div>
      </section>
    </div>
  );
}
