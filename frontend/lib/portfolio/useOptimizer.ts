'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LIQUIDITES_CODE } from './queries';
import { optimize, type OptimizeResult } from './optimize';

interface State {
  data: OptimizeResult | null;
  isLoading: boolean;
  error: string | null;
  insufficient: boolean; // < 2 positions ou historique trop court
}

/** Rendements quotidiens alignés sur les dates communes à tous les actifs. */
function alignedReturns(
  histByCode: Map<string, { date: string; cours: number }[]>,
  codes: string[],
): number[][] | null {
  // Intersection des dates.
  let common: Set<string> | null = null;
  for (const code of codes) {
    const codeDates = new Set<string>((histByCode.get(code) ?? []).map((r) => r.date));
    if (common == null) {
      common = codeDates;
    } else {
      const prev: Set<string> = common;
      common = new Set<string>([...prev].filter((d) => codeDates.has(d)));
    }
  }
  const dates: string[] = [...(common ?? new Set<string>())].sort();
  if (dates.length < 20) return null; // historique commun trop court

  const closesByCode = codes.map((code) => {
    const m = new Map((histByCode.get(code) ?? []).map((r) => [r.date, r.cours]));
    return dates.map((d) => m.get(d)!);
  });
  // Rendements période à période.
  return closesByCode.map((closes) => {
    const r: number[] = [];
    for (let i = 1; i < closes.length; i++) r.push(closes[i - 1] !== 0 ? (closes[i]! - closes[i - 1]!) / closes[i - 1]! : 0);
    return r;
  });
}

export function usePortfolioOptimizer(userId: string): State {
  const [state, setState] = useState<State>({ data: null, isLoading: true, error: null, insufficient: false });
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (!clientRef.current) clientRef.current = createClient();
    if (!userId) { setState({ data: null, isLoading: false, error: null, insufficient: true }); return; }
    const sb = clientRef.current!;

    (async () => {
      try {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        const { data: raw } = await sb
          .from('portfolios_positions').select('code, quantite, prix_entree').eq('user_id', userId);
        const rows = (raw ?? []).filter((r) => r.code !== LIQUIDITES_CODE) as { code: string; quantite: number; prix_entree: number }[];
        const codes = [...new Set(rows.map((r) => r.code))];
        if (codes.length < 2) { setState({ data: null, isLoading: false, error: null, insufficient: true }); return; }

        const since = new Date(Date.now() - 2 * 365 * 86_400_000).toISOString().slice(0, 10);
        const { data: hist } = await sb
          .from('brvm_actions_daily').select('code, cours_jour, date_marche')
          .in('code', codes).gte('date_marche', since).not('cours_jour', 'is', null)
          .order('date_marche', { ascending: true }).limit(5000);

        const histByCode = new Map<string, { date: string; cours: number }[]>();
        for (const r of (hist ?? []) as { code: string; cours_jour: number; date_marche: string }[]) {
          if (!histByCode.has(r.code)) histByCode.set(r.code, []);
          histByCode.get(r.code)!.push({ date: r.date_marche, cours: r.cours_jour });
        }

        const returns = alignedReturns(histByCode, codes);
        if (!returns) { setState({ data: null, isLoading: false, error: null, insufficient: true }); return; }

        // Poids actuels = valeur de marché (quantité × dernier cours).
        const lastCours = (code: string) => { const s = histByCode.get(code); return s && s.length ? s[s.length - 1]!.cours : 0; };
        const values = rows.reduce((acc, r) => { acc[r.code] = (acc[r.code] ?? 0) + r.quantite * lastCours(r.code); return acc; }, {} as Record<string, number>);
        const totalVal = Object.values(values).reduce((a, b) => a + b, 0) || 1;
        const currentWeights = codes.map((c) => (values[c] ?? 0) / totalVal);

        const assets = codes.map((code, i) => ({ code, returns: returns[i]! }));
        setState({ data: optimize(assets, currentWeights, 0.06), isLoading: false, error: null, insufficient: false });
      } catch (err) {
        setState({ data: null, isLoading: false, error: err instanceof Error ? err.message : 'Unknown error', insufficient: false });
      }
    })();
  }, [userId]);

  return state;
}
