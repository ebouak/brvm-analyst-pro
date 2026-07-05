import { createClient } from '@/lib/supabase/server';
import {
  combineDividendsAndEvents,
  filterByKind,
  type CalendarItem,
} from '@/lib/calendarHelpers';
import CalendarFilters from '@/components/CalendarFilters';
import ViewTabs from '@/components/ViewTabs';
import { CALENDAR_TABS } from '@/lib/calendarTabs';
import CalendarTimeline from '@/components/CalendarTimeline';
import CalendarTable from '@/components/CalendarTable';
import {
  SectionHeader,
  PremiumPanel,
  Eyebrow,
  StatPill,
  EmptyStatePremium,
} from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calendrier — WESTBOURSE' };

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

/* ─── KPI card premium ────────────────────────────────────────────────────── */
function CalendarKpiCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: 'gold' | 'emerald' | 'sapphire';
  icon: string;
}) {
  const styles = {
    gold: {
      outer: 'border-gold/20 bg-gold/[0.04]',
      inner: 'border-gold/10',
      number: 'text-gold',
      icon: 'border-gold/20 bg-gold/[0.08] text-gold/60',
    },
    emerald: {
      outer: 'border-up/20 bg-up/[0.04]',
      inner: 'border-up/10',
      number: 'text-up',
      icon: 'border-up/20 bg-up/[0.08] text-up/60',
    },
    sapphire: {
      outer: 'border-sapphire/20 bg-sapphire/[0.04]',
      inner: 'border-sapphire/10',
      number: 'text-sapphire',
      icon: 'border-sapphire/20 bg-sapphire/[0.08] text-sapphire/60',
    },
  }[tone];

  return (
    <div className={`rounded-panel border p-1.5 ${styles.outer} transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.01]`}>
      <div className={`rounded-[calc(1.125rem-0.375rem)] border ${styles.inner} bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-faint">{label}</p>
            <p className={`tabular text-4xl font-bold mt-2 leading-none ${styles.number}`}>{value}</p>
          </div>
          <div className={`grid h-10 w-10 place-items-center rounded-full border text-base flex-shrink-0 ${styles.icon}`}>
            {icon}
          </div>
        </div>
      </div>
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

  const totalFiltered = filtered.length;

  return (
    <div className="min-h-screen bg-bg">
      {/* ── En-tête ────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-6 animate-rise-in">
        <SectionHeader
          kicker="Marché BRVM"
          title="Calendrier économique"
          subtitle={`Dividendes et événements corporatifs sur les ${daysN} prochains jours.`}
          actions={
            <>
              <StatPill tone={totalFiltered > 0 ? 'gold' : 'neutral'}>
                {totalFiltered} événement{totalFiltered > 1 ? 's' : ''}
              </StatPill>
              <a
                href="/api/calendar"
                title="Abonnez-vous dans Google Calendar / Apple / Outlook : les nouvelles ex-dates et paiements apparaîtront automatiquement"
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition-all hover:border-accent/60 hover:bg-accent/20"
              >
                🗓 S'abonner au calendrier (.ics)
              </a>
            </>
          }
        />
        <div className="mt-4">
          <ViewTabs tabs={CALENDAR_TABS} current="/calendrier" />
        </div>
        <div className="gold-rule mt-6" />
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-12 space-y-8">

        {/* ── KPI ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-rise-in">
          <CalendarKpiCard
            label="Ex-dates à venir"
            value={countExDates}
            tone="gold"
            icon="◈"
          />
          <CalendarKpiCard
            label="Paiements à venir"
            value={countPayments}
            tone="emerald"
            icon="◉"
          />
          <CalendarKpiCard
            label="Événements de marché"
            value={countEvents}
            tone="sapphire"
            icon="◎"
          />
        </div>

        {/* ── Filtres ───────────────────────────────────────────────────────── */}
        <PremiumPanel>
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-4">
              <Eyebrow className="text-gold/50">Filtres</Eyebrow>
            </div>
            <CalendarFilters
              type={type}
              days={String(daysN)}
              view={view}
              totalItems={filtered.length}
            />
          </div>
        </PremiumPanel>

        {/* ── Vue principale ────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <EmptyStatePremium
            icon="◎"
            title="Aucun événement sur cette période"
            hint={`Aucun dividende ni événement de marché trouvé pour les ${daysN} prochains jours avec les filtres sélectionnés.`}
          />
        ) : (
          <div className="animate-rise-in">
            {view === 'timeline' ? (
              <CalendarTimeline items={filtered} />
            ) : (
              <CalendarTable items={filtered} />
            )}
          </div>
        )}

        {/* ── Légende ───────────────────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="gold-rule" />
        )}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center gap-4">
            <Eyebrow className="text-faint">Légende</Eyebrow>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="h-1.5 w-4 rounded-full bg-gold/60 inline-block" />
                Ex-date dividende
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="h-1.5 w-4 rounded-full bg-up/60 inline-block" />
                Paiement dividende
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="h-1.5 w-4 rounded-full bg-sapphire/60 inline-block" />
                Événement corporatif
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
