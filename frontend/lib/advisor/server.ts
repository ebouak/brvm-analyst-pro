import { getVerifiedDividends } from '@/lib/dividends/verified';
import { createPublicClient } from '@/lib/supabase/public';
import { getDcfRanking } from '@/lib/dcf/ranking';
import { recommend, type AdvisorResult } from './recommend';

export interface AdvisorRow {
  code: string;
  designation: string | null;
  secteur: string | null;
  cours: number | null;
  sparkline: number[]; // ~30 dernières clôtures (tendance)
  result: AdvisorResult;
}

/**
 * Recommandations unifiées pour toute la cote. Agrège les signaux EXISTANTS
 * (signal quantitatif, valorisation DCF, RSI, dividende) via le moteur pur
 * `recommend`. Conseil, pas exécution.
 */
export async function getAdvisorRecommendations(): Promise<AdvisorRow[]> {
  const sb = createPublicClient();

  // Upside DCF (bulk) — fournit aussi code/désignation/secteur/cours.
  const ranking = await getDcfRanking();

  // Date de séance la plus récente.
  const { data: lastRow } = await sb
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;

  // Signaux quantitatifs (signal + confiance + score_rsi).
  const sigByCode = new Map<string, { signal: 'BUY' | 'SELL' | 'HOLD'; confiance: number | null; score_rsi: number | null }>();
  if (lastDate) {
    const { data: sigs } = await sb
      .from('signals_daily')
      .select('code, signal, confiance, score_rsi')
      .eq('date_marche', lastDate);
    for (const s of (sigs ?? []) as { code: string; signal: 'BUY' | 'SELL' | 'HOLD'; confiance: number | null; score_rsi: number | null }[]) {
      sigByCode.set(s.code, s);
    }
  }

  // Dividende VÉRIFIÉ (détachement daté) par code → rendement. Source unique,
  // jamais les valeurs société biaisées. Voir lib/dividends/verified.ts.
  const verified = await getVerifiedDividends(sb);
  const divByCode = new Map<string, number>();
  for (const [code, v] of verified) divByCode.set(code, v.montant);

  // Historique ~30 séances par code (sparkline de tendance).
  const sparkByCode = new Map<string, number[]>();
  if (lastDate) {
    const since = new Date(lastDate);
    since.setDate(since.getDate() - 50);
    const { data: hist } = await sb
      .from('brvm_actions_daily')
      .select('code, cours_jour')
      .gte('date_marche', since.toISOString().slice(0, 10))
      .lte('date_marche', lastDate)
      .order('date_marche', { ascending: true });
    for (const r of (hist ?? []) as { code: string; cours_jour: number | null }[]) {
      if (r.cours_jour == null) continue;
      const arr = sparkByCode.get(r.code) ?? [];
      arr.push(r.cours_jour);
      sparkByCode.set(r.code, arr);
    }
    for (const [k, v] of sparkByCode) sparkByCode.set(k, v.slice(-30));
  }

  const rows: AdvisorRow[] = ranking.map((r) => {
    const sig = sigByCode.get(r.code);
    // RSI estimé depuis score_rsi (cf. scoring §9 : score_rsi = clamp((50−RSI)/20)).
    const rsi = sig?.score_rsi != null ? Math.max(0, Math.min(100, 50 - 20 * sig.score_rsi)) : null;
    const div = divByCode.get(r.code);
    const dividendYield = div != null && r.cours != null && r.cours > 0 ? (div / r.cours) * 100 : null;

    const result = recommend({
      signal: sig?.signal ?? null,
      confiance: sig?.confiance ?? null,
      dcfUpside: r.upside,
      rsi,
      dividendYield,
    });

    return { code: r.code, designation: r.designation, secteur: r.secteur, cours: r.cours, sparkline: sparkByCode.get(r.code) ?? [], result };
  });

  // Tri : Acheter (forte conviction) en tête, Vendre en bas.
  const rank = (a: AdvisorRow) => (a.result.action === 'acheter' ? 2 : a.result.action === 'conserver' ? 1 : 0);
  rows.sort((a, b) => {
    const dr = rank(b) - rank(a);
    if (dr !== 0) return dr;
    return b.result.conviction - a.result.conviction;
  });

  return rows;
}
