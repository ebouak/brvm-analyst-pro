/**
 * Jour de séance ou non — garde partagée des collecteurs qui datent une page
 * NON DATÉE (brvm.org) avec la date du jour.
 *
 * POURQUOI. Jusqu'au 2026-09-21, runIntraday écrivait la séance précédente
 * sous la date du jour les week-ends et jours fériés : 282 lignes d'actions
 * fantômes (31/05, 13/06, 07/08, 09/08, 25/08, 29/08), recopiées ensuite dans
 * les signaux, indicateurs, liquidité, obligations… (migration 0153).
 * `preuveDeSeance` a fermé la porte côté actions ; runObligations, lui,
 * l'avait encore ouverte. Un jour non ouvré n'a pas de séance : on n'écrit pas.
 */
import { getSupabase } from '../persistence/supabase.js';

/** Vrai si `date` (AAAA-MM-JJ) est un jour de semaine absent des jours fériés. */
export function estJourOuvre(date: string, feries: ReadonlySet<string>): boolean {
  const jour = new Date(`${date}T12:00:00Z`).getUTCDay();
  return jour !== 0 && jour !== 6 && !feries.has(date);
}

/**
 * Raison de ne pas écrire, ou null si `date` est un jour de séance. Lit
 * `market_calendar` ; une lecture impossible n'arrête pas la collecte (le
 * week-end reste refusé, et `preuveDeSeance` protège encore les actions).
 */
export async function jourNonOuvre(date: string): Promise<string | null> {
  let feries = new Set<string>();
  try {
    const { data } = await getSupabase()
      .from('market_calendar').select('date').eq('date', date).eq('is_trading_day', false);
    feries = new Set(((data ?? []) as { date: string }[]).map((r) => r.date));
  } catch {
    /* lecture du calendrier impossible : seul le contrôle du week-end s'applique */
  }
  if (estJourOuvre(date, feries)) return null;
  return feries.has(date) ? `${date} : jour férié (market_calendar)` : `${date} : week-end`;
}
