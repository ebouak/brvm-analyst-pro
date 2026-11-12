// Rapport d'événement (§11/§12) : étude d'impact autour d'une publication. Réutilisé par l'API et la fiche d'événement.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MarketEvent } from './types';
import { eventStudy, fenetreChargement, detachementsDansFenetre, type DatedClose } from './eventStudy';
import { fmtDateFR } from './format';
import { eventHeadline } from './narrative';
import { eventCommentary } from './reportCommentary';

export interface EventReport {
  reportType: 'event';
  event: MarketEvent;
  relatedCodes: string[];
  impact: Record<string, ReturnType<typeof eventStudy>>;
  /** Ex-dates de dividende comprises dans la fenêtre observée, par titre. */
  detachements: Record<string, string[]>;
  explanation: { headline: string; why: string[] };
}

export async function buildEventReport(
  supabase: SupabaseClient,
  id: string,
  window = 5,
): Promise<EventReport | null> {
  const { data: ev } = await supabase.from('market_events').select('*').eq('id', id).maybeSingle();
  if (!ev) return null;
  const event = ev as MarketEvent;

  const { data: pivot } = await supabase
    .from('market_event_instruments').select('instrument_code').eq('event_id', id);
  const codes = new Set<string>((pivot ?? []).map((p) => p.instrument_code as string));
  if (event.instrument_code) codes.add(event.instrument_code);
  const relatedCodes = [...codes];

  // Seule la fenêtre utile est chargée. Lire tout l'historique par ordre croissant
  // avec une limite renvoyait les plus ANCIENNES séances (SNTS : 4 946 lignes
  // depuis 2007, plafond PostgREST à 1 000) : aucune séance après l'événement,
  // donc « historique insuffisant » sur toute valeur ancienne.
  const { debut, fin } = fenetreChargement(event.event_date);

  // Indice BRVM Composite pour le rendement de référence.
  const { data: idx } = await supabase
    .from('brvm_indices_daily').select('date_marche, valeur').eq('code', 'BRVMC')
    .gte('date_marche', debut).lte('date_marche', fin)
    .order('date_marche', { ascending: true });
  const indexSeries: DatedClose[] = (idx ?? []).map((r) => ({ date: r.date_marche as string, close: r.valeur as number | null }));

  const impact: Record<string, ReturnType<typeof eventStudy>> = {};
  const detachements: Record<string, string[]> = {};
  await Promise.all(relatedCodes.map(async (code) => {
    const [{ data: hist }, { data: divs }] = await Promise.all([
      supabase
        .from('brvm_actions_daily').select('date_marche, cours_jour, volume').eq('code', code)
        .gte('date_marche', debut).lte('date_marche', fin)
        .order('date_marche', { ascending: true }),
      supabase
        .from('dividends').select('ex_date').eq('code', code)
        .gte('ex_date', debut).lte('ex_date', fin).gt('montant', 0),
    ]);
    const rows = (hist ?? []) as { date_marche: string; cours_jour: number | null; volume: number | null }[];
    const series: DatedClose[] = rows.map((r) => ({ date: r.date_marche, close: r.cours_jour }));
    const vols = rows.map((r) => r.volume);
    impact[code] = eventStudy(series, vols, indexSeries, event.event_date, window);
    // Les clôtures ne sont pas ajustées du dividende : un détachement dans la
    // fenêtre fait baisser le cours du montant versé, sans rapport avec l'événement.
    const exDates = ((divs ?? []) as { ex_date: string | null }[]).map((d) => d.ex_date).filter((d): d is string => !!d);
    detachements[code] = detachementsDansFenetre(series, impact[code]!, exDates);
  }));

  const firstCode = relatedCodes[0];
  const ar = firstCode ? impact[firstCode]?.abnormalReturnPost ?? null : null;
  const reaction = firstCode ? impact[firstCode]?.reaction ?? 'neutral' : 'neutral';
  const seances = firstCode ? impact[firstCode]?.seancesObservees ?? window : window;
  const headline = firstCode
    ? eventHeadline({ eventDate: event.event_date, code: firstCode, abnormalReturnPost: ar, reaction, window: seances })
    : `Événement du ${fmtDateFR(event.event_date)} : aucun titre rattaché pour mesurer l'impact.`;

  const why = eventCommentary({
    impacts: relatedCodes.map((c) => ({ code: c, rendementAnormalPct: impact[c]?.abnormalReturnPost ?? null })),
    nbTitresLies: relatedCodes.length,
    fenetreSeances: window,
  });

  return { reportType: 'event', event, relatedCodes, impact, detachements, explanation: { headline, why } };
}
