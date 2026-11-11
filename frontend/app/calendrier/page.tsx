import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  combineDividendsAndEvents,
  filterByKind,
  type CalendarItem,
} from '@/lib/calendarHelpers';
import CalendarFilters from '@/components/CalendarFilters';
import ViewTabs from '@/components/ViewTabs';
import { CALENDAR_TABS } from '@/lib/calendarTabs';
import { agAVenir, COLONNES_AG, versCalendrier, type BocAssemblee } from '@/lib/boc/assemblees';
import CalendarTimeline from '@/components/CalendarTimeline';
import CalendarTable from '@/components/CalendarTable';
import { EmptyStatePremium } from '@/components/ui/premium';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calendrier' };

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface RawDividend {
  id: string;
  code: string;
  exercice: number | null;
  ex_date: string | null;
  payment_date: string | null;
  montant: number;
  devise: string;
}

interface RawEvent {
  id: string;
  event_date: string;
  event_datetime: string | null;
  title: string;
  event_type: string;
  instrument_code: string | null;
  issuer_name: string | null;
  sector: string | null;
  country_code: string | null;
  importance_level: number | null;
}

interface RawInstrument {
  code: string;
  designation: string | null;
  secteur: string | null;
  pays: string | null;
}

/* ─── Query ───────────────────────────────────────────────────────────────── */
async function getData(daysN: number): Promise<{
  items: CalendarItem[];
  countExDates: number;
  countPayments: number;
  countEvents: number;
}> {
  const supabase = createClient();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + daysN);
  const endStr = endDate.toISOString().slice(0, 10);

  const [{ data: divData }, { data: evtData }, { data: instrData }] =
    await Promise.all([
      supabase
        .from('dividends')
        .select('id, code, exercice, ex_date, payment_date, montant, devise')
        .or(
          `and(ex_date.gte.${todayStr},ex_date.lte.${endStr}),and(payment_date.gte.${todayStr},payment_date.lte.${endStr})`,
        )
        .order('ex_date', { ascending: true })
        .limit(200),
      supabase
        .from('brvm_events')
        .select(
          'id, event_date, event_datetime, title, event_type, instrument_code, issuer_name, sector, country_code, importance_level',
        )
        .gte('event_date', todayStr)
        .lte('event_date', endStr)
        .order('event_date', { ascending: true })
        .limit(200),
      supabase
        .from('brvm_instruments')
        .select('code, designation, secteur, pays'),
    ]);

  const dividends = (divData ?? []) as RawDividend[];
  const events = (evtData ?? []) as RawEvent[];
  const instruments = (instrData ?? []) as RawInstrument[];

  const instrMap: Record<string, { designation: string | null; secteur: string | null; pays: string | null }> = {};
  for (const ins of instruments) instrMap[ins.code] = ins;

  const items = combineDividendsAndEvents({ dividends, events, instruments: instrMap });

  // AG du Bulletin officiel : date de RÉUNION, encore au dernier bulletin lu.
  // Table illisible (migration 0209 non appliquée) : le calendrier reste servi sans elles.
  const { data: derAg } = await supabase
    .from('boc_assemblees').select('dernier_bulletin').order('dernier_bulletin', { ascending: false }).limit(1);
  const dernier = (derAg?.[0] as { dernier_bulletin?: string } | undefined)?.dernier_bulletin ?? null;
  if (dernier) {
    const { data: agData } = await supabase
      .from('boc_assemblees').select(COLONNES_AG)
      .gte('date_ag', todayStr).lte('date_ag', endStr).eq('dernier_bulletin', dernier)
      .limit(200);
    for (const a of agAVenir((agData ?? []) as BocAssemblee[], todayStr, dernier)) items.push(versCalendrier(a, instrMap));
    items.sort((a, b) => a.date.localeCompare(b.date));
  }

  const countExDates = items.filter((i) => i.kind === 'ex-date').length;
  const countPayments = items.filter((i) => i.kind === 'payment').length;
  const countEvents = items.filter(
    (i) => i.kind !== 'ex-date' && i.kind !== 'payment',
  ).length;

  return { items, countExDates, countPayments, countEvents };
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
interface PageProps {
  searchParams: Promise<{ type?: string; days?: string; view?: string }>;
}

export default async function CalendrierPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const rawType = searchParams.type ?? 'all';
  const type = ['dividende', 'event', 'all'].includes(rawType) ? rawType : 'all';

  const rawDays = searchParams.days ?? '30';
  const daysN = [7, 14, 30, 60, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;

  const rawView = searchParams.view ?? 'timeline';
  const view = ['timeline', 'liste'].includes(rawView) ? rawView : 'timeline';

  const { items, countExDates, countPayments, countEvents } = await getData(daysN);

  const filtered = filterByKind(items, type as 'dividende' | 'event' | 'all');

  const compteurs = [
    { libelle: 'Détachements', n: countExDates },
    { libelle: 'Paiements', n: countPayments },
    { libelle: 'Événements de société', n: countEvents },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <EnTeteCote
        titre="Calendrier"
        description={`Détachements et paiements de dividendes, assemblées et publications des sociétés cotées, sur les ${daysN} prochains jours.`}
        source={null}
        actions={
          <a
            href="/api/calendar"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-border-strong px-4 text-sm text-accent-ink transition-colors hover:border-accent hover:bg-elevated active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            S’abonner au calendrier
          </a>
        }
      />
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
        {compteurs.map((c) => (
          <div key={c.libelle} className="flex gap-1.5">
            <dt>{c.libelle}</dt>
            <dd className="tabular text-ivory">{c.n}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6">
        <ViewTabs tabs={CALENDAR_TABS} current="/calendrier" />
      </div>

      <div className="mt-8 border-t border-border-strong pt-6">
        <CalendarFilters type={type} days={String(daysN)} view={view} totalItems={filtered.length} />
      </div>

      <div className="mt-6">
        {filtered.length === 0 ? (
          <EmptyStatePremium
            title="Rien d’annoncé sur cette période"
            hint={`Aucun dividende ni événement de société pour les ${daysN} prochains jours avec ces filtres. Une période plus longue en montrera peut-être.`}
            action={{ href: '/calendrier?type=all&days=90&view=timeline', label: 'Voir les 90 prochains jours' }}
          />
        ) : view === 'timeline' ? (
          <CalendarTimeline items={filtered} />
        ) : (
          <CalendarTable items={filtered} />
        )}
        <LigneSource>
          Dividendes : calendrier officiel de la BRVM et Bulletin officiel de la cote, à défaut les sources publiques ;
          montant par action tel que publié. Événements : publications des sociétés et de la BRVM.{' '}
          L’abonnement ajoute les nouvelles dates à Google Agenda, Apple Calendrier ou Outlook (format .ics).{' '}
          <Link href="/dividendes" className="underline underline-offset-2 hover:text-muted">Tous les dividendes</Link>
        </LigneSource>
      </div>
    </div>
  );
}
