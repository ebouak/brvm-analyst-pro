import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { monthlyReturnsFromPrices, type MonthlyReturn, type DailyClose } from './compute';

const WINDOW_YEARS_MAX = 15; // plafond fetch (borne la bande passante)
const PAGE = 1000;

/**
 * Série mensuelle compacte (≈180 points) d'un titre, sur 15 ans max.
 * Mémoïsée par rendu (React.cache) → encart fiche + page partagent le calcul.
 */
export const getMonthlyReturns = cache(async (code: string): Promise<MonthlyReturn[]> => {
  const sb = createPublicClient();
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - WINDOW_YEARS_MAX);
  const fromDate = since.toISOString().slice(0, 10);

  const closes: DailyClose[] = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const { data } = await sb
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour')
      .eq('code', code.toUpperCase())
      .gte('date_marche', fromDate)
      .not('cours_jour', 'is', null)
      .order('date_marche', { ascending: true })
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as Array<{ date_marche: string; cours_jour: number }>;
    for (const r of batch) closes.push({ date: r.date_marche, close: r.cours_jour });
    if (batch.length < PAGE) break;
  }
  return monthlyReturnsFromPrices(closes);
});
