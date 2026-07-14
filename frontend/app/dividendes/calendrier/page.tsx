import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader } from '@/components/ui/premium';
import ViewTabs from '@/components/ViewTabs';
import { CALENDAR_TABS } from '@/lib/calendarTabs';
import { DividendCalendar } from '@/components/DividendCalendar';
import { EmptyStatePremium } from '@/components/ui/premium';
import type { DividendCalendarEvent } from '@/lib/dividend/calendar';

export const metadata: Metadata = {
  title: 'Calendrier des Dividendes',
  description: 'Calendrier annuel interactif des dividendes avec dates de détachement, taux et rendements estimés',
};

export const dynamic = 'force-dynamic';

async function getDividends(): Promise<DividendCalendarEvent[]> {
  const supabase = createClient();

  // Fetch all dividends with instrument details
  const { data: divData, error: divError } = await supabase
    .from('dividends')
    .select(`
      id,
      code,
      ex_date,
      payment_date,
      montant,
      brvm_instruments (
        designation,
        secteur
      )
    `)
    .order('ex_date', { ascending: false });

  if (divError) {
    console.error('Error fetching dividends:', divError);
    return [];
  }

  if (!divData || divData.length === 0) {
    return [];
  }

  // Get unique codes and fetch their latest cours_jour + taux info
  const codes = [...new Set((divData as any[]).map((d) => d.code))];

  let coursesByCode = new Map<string, number | null>();
  let tauxByCode = new Map<string, number>();

  // Fetch latest cours_jour for each code
  if (codes.length > 0) {
    const { data: latestDateData } = await supabase
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1);

    const lastDate = (latestDateData as any[])?.[0]?.date_marche ?? null;

    if (lastDate) {
      const { data: actionsData } = await supabase
        .from('brvm_actions_daily')
        .select('code, cours_jour')
        .eq('date_marche', lastDate)
        .in('code', codes);

      for (const action of (actionsData as any[]) ?? []) {
        coursesByCode.set(action.code, action.cours_jour);
      }
    }

    // Fetch taux from dividend events (ex_date, montant to estimate taux)
    // For now, we'll calculate taux from historical context
    // If taux field exists in dividends table, fetch it directly
  }

  // Transform data
  const result: DividendCalendarEvent[] = (divData as any[]).map((div) => {
    const cours = coursesByCode.get(div.code) ?? null;
    const instrument = div.brvm_instruments as any;

    // Calculate rendement if we have cours
    let rendement: number | null = null;
    if (cours && cours > 0 && div.montant > 0) {
      rendement = (div.montant / cours) * 100;
    }

    return {
      id: div.id,
      code: div.code,
      designation: instrument?.designation ?? null,
      secteur: instrument?.secteur ?? null,
      taux: rendement,
      ex_date: div.ex_date,
      payment_date: div.payment_date,
      cours_jour: cours,
      rendement_pct: rendement,
      montant: div.montant,
    };
  });

  return result;
}

export default async function DividendCalendarPage() {
  const dividends = await getDividends();
  const today = new Date();

  return (
    <div className="min-h-screen bg-bg">
      <div className={`mx-auto px-4 py-8 space-y-8`}>
        <SectionHeader
          kicker="Calendrier boursier"
          title="Dividendes"
          subtitle="Calendrier annuel interactif · dates de détachement, taux et rendements estimés"
        />
        <ViewTabs tabs={CALENDAR_TABS} current="/dividendes/calendrier" />

        {dividends.length === 0 ? (
          <EmptyStatePremium
            icon="◎"
            title="Aucun dividende enregistré"
            hint="Le calendrier des dividendes s'alimentera au fur et à mesure des annonces de distributions."
          />
        ) : (
          <div className="max-w-6xl">
            <DividendCalendar
              dividends={dividends}
              defaultYear={today.getFullYear()}
              defaultMonth={today.getMonth()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
