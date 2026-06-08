import { createClient } from '@/lib/supabase/server';

export type TypeDate = 'publication' | 'dividende_annonce' | 'dividende_paiement' | 'ag';

export interface DateCle {
  date: string;
  type: TypeDate;
  code: string;
  designation: string;
  detail: string;
}

export async function getDatesClés(moisFutur: number = 12): Promise<DateCle[]> {
  const supabase = createClient();
  const depuis = new Date();
  depuis.setMonth(depuis.getMonth() - 3);
  const jusqua = new Date();
  jusqua.setMonth(jusqua.getMonth() + moisFutur);
  const depuisStr = depuis.toISOString().split('T')[0]!;
  const jusquaStr = jusqua.toISOString().split('T')[0]!;

  const results: DateCle[] = [];

  // Publications états financiers
  const { data: pubs } = await supabase
    .from('publications')
    .select('code, date_publication, libelle, brvm_instruments(designation)')
    .gte('date_publication', depuisStr)
    .lte('date_publication', jusquaStr)
    .order('date_publication', { ascending: true });

  for (const p of pubs ?? []) {
    const instr = (Array.isArray(p.brvm_instruments) ? p.brvm_instruments[0] : p.brvm_instruments) as { designation: string } | null;
    results.push({
      date: p.date_publication,
      type: 'publication',
      code: p.code,
      designation: instr?.designation ?? p.code,
      detail: p.libelle,
    });
  }

  // Dividendes — ex_date et payment_date
  const { data: divs } = await supabase
    .from('dividends')
    .select('code, ex_date, payment_date, montant, exercice, brvm_instruments(designation)')
    .gte('ex_date', depuisStr)
    .order('ex_date', { ascending: true });

  for (const d of divs ?? []) {
    const instr = (Array.isArray(d.brvm_instruments) ? d.brvm_instruments[0] : d.brvm_instruments) as { designation: string } | null;
    const designation = instr?.designation ?? d.code;
    if (d.ex_date) {
      results.push({
        date: d.ex_date,
        type: 'dividende_annonce',
        code: d.code,
        designation,
        detail: `Dividende ${d.exercice ?? ''} : ${d.montant} FCFA — détachement`,
      });
    }
    if (d.payment_date) {
      results.push({
        date: d.payment_date,
        type: 'dividende_paiement',
        code: d.code,
        designation,
        detail: `Paiement dividende ${d.exercice ?? ''} : ${d.montant} FCFA`,
      });
    }
  }

  // Événements AG (event_type = 'assemblee' dans market_events)
  const { data: events } = await supabase
    .from('market_events')
    .select('instrument_code, event_date, title, issuer_name')
    .eq('event_type', 'assemblee')
    .gte('event_date', depuisStr)
    .lte('event_date', jusquaStr)
    .order('event_date', { ascending: true });

  for (const e of events ?? []) {
    results.push({
      date: e.event_date,
      type: 'ag',
      code: e.instrument_code ?? '',
      designation: e.issuer_name ?? e.instrument_code ?? '',
      detail: e.title,
    });
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}
