import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';

export interface BacktestStats {
  n: number;
  avgPerfPct: number | null;
  pctPositive: number | null;
  periodFrom: string | null;
  periodTo: string | null;
}

/**
 * Statistiques du backtest rétroactif (méthode de scoring actuelle appliquée
 * à l'historique des cours), sur les `monthsBack` derniers mois — fenêtre
 * représentative du marché récent plutôt que tout l'historique depuis 1998.
 */
export async function getBacktestStats(monthsBack = 24): Promise<BacktestStats> {
  const supabase = createPublicClient();
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data } = await supabase
    .from('signals_backtest')
    .select('perf_pct, date_signal')
    .gte('date_signal', sinceStr)
    .not('perf_pct', 'is', null);

  const rows = (data ?? []) as { perf_pct: number; date_signal: string }[];
  if (rows.length === 0) {
    return { n: 0, avgPerfPct: null, pctPositive: null, periodFrom: null, periodTo: null };
  }
  const avgPerfPct = rows.reduce((a, r) => a + r.perf_pct, 0) / rows.length;
  const pctPositive = (rows.filter((r) => r.perf_pct > 0).length / rows.length) * 100;
  const dates = rows.map((r) => r.date_signal).sort();
  return {
    n: rows.length,
    avgPerfPct,
    pctPositive,
    periodFrom: dates[0] ?? null,
    periodTo: dates[dates.length - 1] ?? null,
  };
}

export interface RecentRealSignal {
  code: string;
  designation: string | null;
  dateSignal: string;
  coursSignal: number;
  coursActuel: number | null;
  perfPct: number | null;
  joursEcoules: number;
}

/**
 * Les VRAIS signaux BUY émis en production (signals_daily), distincts du
 * backtest rétroactif. Performance calculée à ce jour (pas à horizon fixe,
 * puisque le signal peut être récent).
 */
export async function getRecentRealBuySignals(limit = 10): Promise<RecentRealSignal[]> {
  const supabase = createPublicClient();

  const { data: sigs } = await supabase
    .from('signals_daily')
    .select('code, date_marche')
    .eq('signal', 'BUY')
    .order('date_marche', { ascending: false })
    .limit(limit);

  const rows = (sigs ?? []) as { code: string; date_marche: string }[];
  if (rows.length === 0) return [];

  const codes = [...new Set(rows.map((r) => r.code))];
  const [{ data: instruments }, { data: lastPrices }] = await Promise.all([
    supabase.from('brvm_instruments').select('code, designation').in('code', codes),
    supabase.from('brvm_actions_daily').select('code, date_marche, cours_jour').in('code', codes).order('date_marche', { ascending: false }),
  ]);

  const designationMap = new Map((instruments ?? []).map((i: { code: string; designation: string | null }) => [i.code, i.designation]));
  const lastPriceMap = new Map<string, number>();
  for (const p of (lastPrices ?? []) as { code: string; cours_jour: number | null }[]) {
    if (!lastPriceMap.has(p.code) && p.cours_jour != null) lastPriceMap.set(p.code, p.cours_jour);
  }

  // Cours au moment du signal (pour calculer la perf depuis émission).
  const signalPrices = await Promise.all(
    rows.map((r) =>
      supabase
        .from('brvm_actions_daily')
        .select('cours_jour')
        .eq('code', r.code)
        .eq('date_marche', r.date_marche)
        .maybeSingle(),
    ),
  );

  const today = new Date();
  return rows.map((r, i) => {
    const coursSignal = (signalPrices[i]?.data?.cours_jour as number | null | undefined) ?? null;
    const coursActuel = lastPriceMap.get(r.code) ?? null;
    const perfPct = coursSignal != null && coursActuel != null ? ((coursActuel - coursSignal) / coursSignal) * 100 : null;
    const joursEcoules = Math.round((today.getTime() - new Date(r.date_marche + 'T00:00:00Z').getTime()) / 86_400_000);
    return {
      code: r.code,
      designation: designationMap.get(r.code) ?? null,
      dateSignal: r.date_marche,
      coursSignal: coursSignal ?? 0,
      coursActuel,
      perfPct,
      joursEcoules,
    };
  });
}
