import type { SupabaseClient } from '@supabase/supabase-js';
import { dernierEvenementResultats, type EvenementResultats } from './miseAJour';

/**
 * Dernière publication de résultats ingérée pour un code (table `market_events`,
 * type `resultats`), rattachée soit directement (`instrument_code`), soit par le
 * pivot `market_event_instruments`. Lecture seule. Tolérant : toute erreur donne
 * null, la Revue s'affiche simplement sans la mention.
 */
export async function chargerDerniereMiseAJour(sb: SupabaseClient, code: string): Promise<EvenementResultats | null> {
  try {
    const [direct, pivot] = await Promise.all([
      sb.from('market_events').select('event_date, created_at')
        .eq('event_type', 'resultats').eq('instrument_code', code)
        .order('event_date', { ascending: false }).limit(5),
      sb.from('market_event_instruments').select('event_id').eq('instrument_code', code).limit(500),
    ]);
    const evts: EvenementResultats[] = [...((direct.data ?? []) as EvenementResultats[])];
    const ids = ((pivot.data ?? []) as { event_id: string }[]).map((r) => r.event_id);
    if (ids.length > 0) {
      const { data } = await sb.from('market_events').select('event_date, created_at')
        .eq('event_type', 'resultats').in('id', ids)
        .order('event_date', { ascending: false }).limit(5);
      evts.push(...((data ?? []) as EvenementResultats[]));
    }
    return dernierEvenementResultats(evts);
  } catch {
    return null;
  }
}
