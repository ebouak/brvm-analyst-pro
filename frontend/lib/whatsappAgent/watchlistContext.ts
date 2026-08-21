// frontend/lib/whatsappAgent/watchlistContext.ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WatchlistContextItem } from './systemPrompt';

/**
 * Récupère les codes de la watchlist d'un utilisateur, puis les enrichit avec
 * les vraies données de la dernière séance disponible (brvm_actions_daily,
 * signals_daily) — jamais de chiffre inventé pour un code sans donnée du jour
 * (voir formatWatchlistItem dans systemPrompt.ts, qui gère ce cas
 * explicitement plutôt que de l'omettre silencieusement).
 */
export async function getWatchlistContext(
  db: SupabaseClient,
  userId: string,
): Promise<WatchlistContextItem[]> {
  const { data: watchlistRows } = await db
    .from('watchlist_items')
    .select('code, watchlists!inner(user_id)')
    .eq('watchlists.user_id', userId);

  const codes = [...new Set((watchlistRows ?? []).map((r) => r.code as string))];
  if (codes.length === 0) return [];

  const { data: lastDay } = await db
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const asOf = (lastDay?.date_marche as string | undefined) ?? null;

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
