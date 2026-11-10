import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ViewTabs from '@/components/ViewTabs';
import { CALENDAR_TABS } from '@/lib/calendarTabs';
import { DividendCalendar } from '@/components/DividendCalendar';
import { EmptyStatePremium } from '@/components/ui/premium';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';
import type { DividendCalendarEvent } from '@/lib/dividend/calendar';

export const metadata: Metadata = {
  title: 'Calendrier des dividendes',
  description: 'Calendrier mensuel des dividendes : dates de détachement et de paiement, montants par action.',
};

export const dynamic = 'force-dynamic';

interface LigneDividende {
  id: string;
  code: string;
  exercice: number | null;
  ex_date: string;
  payment_date: string;
  montant: number;
  brvm_instruments: { designation: string | null; secteur: string | null } | null;
}

async function getDividends(): Promise<{ events: DividendCalendarEvent[]; dateCours: string | null }> {
  const supabase = createClient();

  const { data: divData, error: divError } = await supabase
    .from('dividends')
    .select('id, code, exercice, ex_date, payment_date, montant, brvm_instruments ( designation, secteur )')
    .order('ex_date', { ascending: false });

  if (divError || !divData || divData.length === 0) return { events: [], dateCours: null };
  const lignes = divData as unknown as LigneDividende[];

  const codes = [...new Set(lignes.map((d) => d.code))];
  const coursParCode = new Map<string, number | null>();
  const { data: derniere } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const dateCours = (derniere as { date_marche: string }[] | null)?.[0]?.date_marche ?? null;
  if (dateCours && codes.length > 0) {
    const { data: actions } = await supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour')
      .eq('date_marche', dateCours)
      .in('code', codes);
    for (const a of (actions as { code: string; cours_jour: number | null }[] | null) ?? []) coursParCode.set(a.code, a.cours_jour);
  }

  // Un rendement n'a de sens que pour le DERNIER exercice distribué d'une société :
  // rapporter un dividende ancien au cours d'aujourd'hui ne mesure rien (même
  // règle que /dividendes, lib/dividendes/classement.ts). Pour les autres lignes,
  // rendement ET cours sont mis à nul : estimatedYield() le recalculerait sinon.
  const dernierExercice = new Map<string, number>();
  for (const d of lignes) {
    if (d.exercice != null && d.montant > 0) dernierExercice.set(d.code, Math.max(dernierExercice.get(d.code) ?? -Infinity, d.exercice));
  }

  const events: DividendCalendarEvent[] = lignes.map((d) => {
    const recent = d.exercice != null && d.exercice === dernierExercice.get(d.code);
    const cours = recent ? coursParCode.get(d.code) ?? null : null;
    const rendement = cours && cours > 0 && d.montant > 0 ? (d.montant / cours) * 100 : null;
    return {
      id: d.id,
      code: d.code,
      designation: d.brvm_instruments?.designation ?? null,
      secteur: d.brvm_instruments?.secteur ?? null,
      taux: rendement,
      ex_date: d.ex_date,
      payment_date: d.payment_date,
      cours_jour: cours,
      rendement_pct: rendement,
      montant: d.montant,
    };
  });

  return { events, dateCours };
}

export default async function DividendCalendarPage() {
  const { events, dateCours } = await getDividends();
  const today = new Date();

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <EnTeteCote
        titre="Calendrier des dividendes"
        description="Les dates de détachement et de paiement mois par mois, avec le montant par action."
        seance={dateCours}
        libelleSeance="Cours du"
        source={null}
      />
      <div className="mt-6">
        <ViewTabs tabs={CALENDAR_TABS} current="/dividendes/calendrier" />
      </div>

      <div className="mt-8 border-t border-border-strong pt-6">
        {events.length === 0 ? (
          <EmptyStatePremium
            title="Aucun dividende enregistré"
            hint="Le calendrier se remplit au fil des annonces de distribution."
            action={{ href: '/dividendes', label: 'Voir les dividendes' }}
          />
        ) : (
          <DividendCalendar dividends={events} defaultYear={today.getFullYear()} defaultMonth={today.getMonth()} />
        )}
        <LigneSource>
          Dates du calendrier officiel des dividendes de la BRVM et du Bulletin officiel de la cote, à défaut des
          sources publiques ; montant par action tel que publié. Le rendement n’est indiqué que pour le dernier
          exercice distribué de chaque société, rapporté au dernier cours de clôture.{' '}
          <Link href="/dividendes" className="underline underline-offset-2 hover:text-muted">Tous les dividendes</Link>
        </LigneSource>
      </div>
    </div>
  );
}
