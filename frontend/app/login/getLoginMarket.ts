// Cours du jour pour le bandeau de la page de connexion (lecture publique RLS).
import { createPublicClient } from '@/lib/supabase/public';

export interface LoginTick {
  sym: string;
  val: string;
  dir: 'up' | 'down';
  pct: string;
}

export interface LoginCandle {
  code: string;
  /** Variation du jour en % (réelle). */
  pct: number;
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export async function getLoginMarket(): Promise<{
  asOf: string | null;
  ticks: LoginTick[];
  candles: LoginCandle[];
}> {
  const supabase = createPublicClient();

  const { data: lastDay } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();

  const asOf = (lastDay?.date_marche as string | undefined) ?? null;
  if (!asOf) return { asOf: null, ticks: [], candles: [] };

  const { data: rows } = await supabase
    .from('brvm_actions_daily')
    .select('code, cours_jour, variation_pct')
    .eq('date_marche', asOf)
    .order('variation_pct', { ascending: false });

  const all = (rows ?? []) as {
    code: string;
    cours_jour: number | null;
    variation_pct: number | null;
  }[];

  const ticks: LoginTick[] = all
    .filter((r) => r.variation_pct != null)
    .map((r) => ({
      sym: r.code,
      val: r.cours_jour != null ? nf.format(r.cours_jour) : '—',
      dir: (r.variation_pct ?? 0) >= 0 ? ('up' as const) : ('down' as const),
      pct: `${(r.variation_pct ?? 0) >= 0 ? '+' : ''}${(r.variation_pct ?? 0).toFixed(2)}%`,
    }));

  // Bougies : les plus fortes variations du jour (amplitude décroissante).
  const withVar = all.filter((r) => r.variation_pct != null);
  const candles: LoginCandle[] = [...withVar]
    .sort((a, b) => Math.abs(b.variation_pct ?? 0) - Math.abs(a.variation_pct ?? 0))
    .slice(0, 14)
    .map((r) => ({ code: r.code, pct: r.variation_pct ?? 0 }));

  return { asOf, ticks, candles };
}
