import { getVerifiedDividends } from '@/lib/dividends/verified';
import { createPublicClient } from '@/lib/supabase/public';
import { yieldToMaturity, yearsTo, parseObligationDesignation } from '@/lib/bonds';
import { toReturns, buildComparison, type AssetClassPoint } from './assetClasses';

const RISK_FREE = 0.06;

/** Compare les classes d'actifs BRVM sur un plan rendement/risque. */
export async function getAssetComparison(): Promise<AssetClassPoint[]> {
  const sb = createPublicClient();
  const since = new Date(Date.now() - 2 * 365 * 86_400_000).toISOString().slice(0, 10);

  // 1) Indice BRVM-C : rendements quotidiens (2 ans).
  const { data: idx } = await sb
    .from('brvm_indices_daily').select('valeur, date_marche')
    .eq('code', 'BRVMC').gte('date_marche', since).not('valeur', 'is', null)
    .order('date_marche', { ascending: true }).limit(5000);
  const levels = ((idx ?? []) as { valeur: number }[]).map((r) => r.valeur).filter((v) => v > 0);
  const marketReturns = levels.length >= 2 ? toReturns(levels) : [];

  // 2) Obligations : YTM moyen (dernière séance).
  let obligationYtm: number | null = null;
  const { data: lastOblRow } = await sb
    .from('brvm_obligations_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastOblDate = (lastOblRow as { date_marche: string }[] | null)?.[0]?.date_marche ?? null;
  if (lastOblDate) {
    const { data: obls } = await sb
      .from('brvm_obligations_daily').select('designation, taux_pct, maturite, cours_jour').eq('date_marche', lastOblDate);
    const ytms: number[] = [];
    for (const o of (obls ?? []) as { designation: string | null; taux_pct: number | null; maturite: string | null; cours_jour: number | null }[]) {
      const parsed = parseObligationDesignation(o.designation);
      const coupon = o.taux_pct ?? parsed.couponPct;
      const maturite = o.maturite ?? parsed.maturite;
      const years = yearsTo(maturite);
      if (o.cours_jour != null && coupon != null && years != null) {
        const y = yieldToMaturity({ prix: o.cours_jour, couponRatePct: coupon, yearsToMaturity: years, face: 100 });
        if (y != null && y > 0 && y < 100) ytms.push(y / 100);
      }
    }
    if (ytms.length) obligationYtm = ytms.reduce((a, b) => a + b, 0) / ytms.length;
  }

  // 3) Revenu dividende : rendement moyen (dernier montant / dernier cours).
  let dividendYield: number | null = null;
  // Dividendes VÉRIFIÉS (détachement daté) — source unique, jamais les valeurs
  // société biaisées. Voir lib/dividends/verified.ts.
  const verified = await getVerifiedDividends(sb);
  const latestDiv = new Map<string, number>();
  for (const [code, v] of verified) latestDiv.set(code, v.montant);
  const divCodes = [...latestDiv.keys()];
  if (divCodes.length) {
    const { data: lastActRow } = await sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    const actDate = (lastActRow as { date_marche: string }[] | null)?.[0]?.date_marche ?? null;
    if (actDate) {
      const { data: acts } = await sb.from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', actDate).in('code', divCodes);
      const yields: number[] = [];
      for (const a of (acts ?? []) as { code: string; cours_jour: number | null }[]) {
        const m = latestDiv.get(a.code);
        if (m && a.cours_jour && a.cours_jour > 0) yields.push(m / a.cours_jour);
      }
      if (yields.length) dividendYield = yields.reduce((a, b) => a + b, 0) / yields.length;
    }
  }

  return buildComparison({ marketReturns, obligationYtm, obligationVol: null, dividendYield, riskFreeRate: RISK_FREE });
}
