import { createClient } from '@/lib/supabase/server';
import {
  combineDividendsAndEvents,
  filterByKind,
  type CalendarItem,
} from '@/lib/calendarHelpers';
import CalendarFilters from '@/components/CalendarFilters';
import CalendarTimeline from '@/components/CalendarTimeline';
import CalendarTable from '@/components/CalendarTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calendrier — BRVM Analyst Pro' };

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

  const countExDates = items.filter((i) => i.kind === 'ex-date').length;
  const countPayments = items.filter((i) => i.kind === 'payment').length;
  const countEvents = items.filter(
    (i) => i.kind !== 'ex-date' && i.kind !== 'payment',
  ).length;

  return { items, countExDates, countPayments, countEvents };
}

/* ─── Stats card ─────────────────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className={`text-3xl font-bold tabular ${color}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
interface PageProps {
  searchParams: { type?: string; days?: string; view?: string };
}

export default async function CalendrierPage({ searchParams }: PageProps) {
  const rawType = searchParams.type ?? 'all';
  const type = ['dividende', 'event', 'all'].includes(rawType) ? rawType : 'all';

  const rawDays = searchParams.days ?? '30';
  const daysN = [7, 14, 30, 60, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;

  const rawView = searchParams.view ?? 'timeline';
  const view = ['timeline', 'liste'].includes(rawView) ? rawView : 'timeline';

  const { items, countExDates, countPayments, countEvents } = await getData(daysN);

  const filtered = filterByKind(
    items,
    type as 'dividende' | 'event' | 'all',
  );

  return (
    <div className="min-h-screen bg-bg px-4 py-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          📅 Calendrier économique BRVM
        </h1>
        <p className="text-sm text-muted mt-1">
          Dividendes et événements de marché sur les {daysN} prochains jours
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Ex-dates à venir" value={countExDates} color="text-warn" />
        <StatCard label="Paiements à venir" value={countPayments} color="text-up" />
        <StatCard label="Événements à venir" value={countEvents} color="text-blue" />
      </div>

      {/* Filtres */}
      <CalendarFilters
        type={type}
        days={String(daysN)}
        view={view}
        totalItems={filtered.length}
      />

      {/* Vue principale */}
      {view === 'timeline' ? (
        <CalendarTimeline items={filtered} />
      ) : (
        <CalendarTable items={filtered} />
      )}
    </div>
  );
}
