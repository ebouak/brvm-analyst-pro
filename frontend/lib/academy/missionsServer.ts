import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { EMPTY_ACTIVITY_SNAPSHOT, type ActivitySnapshot } from './missions';

async function safeCount(
  promise: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await promise;
    if (error || count == null) return 0;
    return Math.max(0, count);
  } catch {
    return 0;
  }
}

async function countWatchlistItems(userId: string): Promise<number> {
  try {
    const svc = getServiceClient();
    const { data, error } = await svc
      .from('watchlists')
      .select('id')
      .eq('user_id', userId);
    if (error || !data?.length) return 0;
    const ids = (data as { id: string }[]).map((w) => w.id);
    return safeCount(
      svc
        .from('watchlist_items')
        .select('id', { count: 'exact', head: true })
        .in('watchlist_id', ids),
    );
  } catch {
    return 0;
  }
}

/**
 * Lit les compteurs d'activité réelle d'un utilisateur sur les tables
 * WestBourse pour auto-valider sa checklist « Apprendre → Pratiquer ».
 */
export async function chargerActiviteMissions(
  userId: string,
  passedExamsCount: number,
): Promise<ActivitySnapshot> {
  if (!userId) return { ...EMPTY_ACTIVITY_SNAPSHOT, passedExamsCount };
  const svc = getServiceClient();

  const [
    watchlistCount,
    paperAccountsCount,
    ordersCount,
    paperPositionsCount,
    alertsCount,
    thesesCount,
    portfolioPositionsCount,
  ] = await Promise.all([
    countWatchlistItems(userId),
    safeCount(svc.from('paper_trading_accounts').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safeCount(svc.from('paper_trading_orders').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safeCount(svc.from('paper_trading_positions').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safeCount(svc.from('alerts').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safeCount(svc.from('investment_theses').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safeCount(
      svc
        .from('portfolios_positions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('quantite', 0),
    ),
  ]);

  return {
    watchlistCount,
    paperAccountsCount,
    paperOrdersCount: Math.max(ordersCount, paperPositionsCount),
    alertsCount,
    thesesCount,
    portfolioPositionsCount,
    passedExamsCount: Math.max(0, passedExamsCount),
  };
}
