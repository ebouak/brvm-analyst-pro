import { createClient } from './supabase/server';

/** Returns the set of trading day dates (YYYY-MM-DD) from market_calendar. */
export async function getTradingDays(from: string, to: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase
    .from('market_calendar')
    .select('date')
    .eq('is_trading_day', true)
    .gte('date', from)
    .lte('date', to);
  return new Set((data ?? []).map((r: { date: string }) => r.date));
}

/** Checks if a given date (YYYY-MM-DD) is a UEMOA trading day. */
export async function isTradingDay(date: string): Promise<boolean> {
  const days = await getTradingDays(date, date);
  return days.has(date);
}
