// frontend/lib/whatsappAgent/watchlistContext.ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WatchlistContextItem } from './systemPrompt';
import { getLastMarketDate } from '@/lib/marketDate';

/**
 * Récupère les codes de la watchlist d'un utilisateur, puis les enrichit avec
 * les vraies données de la dernière séance disponible (brvm_actions_daily,
 * signals_daily) — jamais de chiffre inventé pour un code sans donnée du jour
 * (voir formatWatchlistItem dans systemPrompt.ts, qui gère ce cas
 * explicitement plutôt que de l'omettre silencieusement).
 *
 * Appelée à chaque message WhatsApp entrant (chemin critique de latence) :
 * la requête watchlist et la résolution de la dernière date de séance sont
 * mutuellement indépendantes et partent donc en parallèle.
 */
export async function getWatchlistContext(
  db: SupabaseClient,
  userId: string,
): Promise<WatchlistContextItem[]> {
  const [{ data: watchlistRows }, asOf] = await Promise.all([
    db.from('watchlist_items').select('code, watchlists!inner(user_id)').eq('watchlists.user_id', userId),
    getLastMarketDate(db),
  ]);

  // Plafond défensif : aucune limite serveur n'existe sur la taille d'une
  // watchlist, et rien dans le pipeline (prompt système, historique) ne
  // borne la taille du contexte envoyé au LLM à chaque message — un
  // utilisateur suivant une grande partie des 48 valeurs de la BRVM ne doit
  // pas faire gonfler chaque appel LLM indéfiniment.
  const MAX_WATCHLIST_CODES = 20;
  const codes = [...new Set((watchlistRows ?? []).map((r) => r.code as string))].slice(0, MAX_WATCHLIST_CODES);
  if (codes.length === 0) return [];

  if (!asOf) {
    return codes.map((code) => ({ code, cours: null, variationPct: null, signal: null, confiance: null }));
  }

  const [{ data: actions }, { data: signals }] = await Promise.all([
    db
      .from('brvm_actions_daily')
      .select('code, cours_jour, variation_pct')
      .eq('date_marche', asOf)
      .in('code', codes),
    db
      .from('signals_daily')
      .select('code, signal, confiance')
      .eq('date_marche', asOf)
      .in('code', codes),
  ]);

  const actionsByCode = new Map((actions ?? []).map((a) => [a.code as string, a]));
  const signalsByCode = new Map((signals ?? []).map((s) => [s.code as string, s]));

  return codes.map((code) => {
    const action = actionsByCode.get(code);
    const signal = signalsByCode.get(code);
    return {
      code,
      cours: (action?.cours_jour as number | undefined) ?? null,
      variationPct: (action?.variation_pct as number | undefined) ?? null,
      signal: (signal?.signal as string | undefined) ?? null,
      confiance: (signal?.confiance as number | undefined) ?? null,
    };
  });
}
