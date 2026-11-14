import { createPublicClient } from '@/lib/supabase/public';
import { computeMetrics, isReliable, type Fundamentals, type ValuationMetrics } from './metrics';
import { comparableRetenu, computeFairValue, median, type FairValueResult } from './fairValue';
import { computeQuality, type QualityScore } from './quality';
import { buildVerdict, type ValuationVerdict } from './verdict';

/** Comptes plus anciens que l'année en cours moins ce nombre : non estimable (B3). */
export const AGE_MAX_EXERCICE = 2;

export interface CompanyValuation {
  code: string;
  designation: string | null;
  secteur: string;
  price: number | null;
  shares: number | null;
  metrics: ValuationMetrics;
  fairValue: FairValueResult;
  quality: QualityScore;
  verdict: ValuationVerdict;
}

interface FundRow { code: string; year: number | null; revenue: number | null; net_income: number | null; equity: number | null; cash: number | null; debt: number | null; }

function pickLatest(rows: FundRow[]): { current: Fundamentals; previous: Fundamentals | null } | null {
  const reliable = rows
    .filter((r) => isReliable(r))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  if (reliable.length === 0) {
    // garde la plus récente même non fiable pour signaler « non exploitable »
    const any = [...rows].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
    return any ? { current: any, previous: null } : null;
  }
  return { current: reliable[0]!, previous: reliable[1] ?? null };
}

/** Calcule la valorisation de TOUT le marché (médianes sectorielles incluses). */
export async function getMarketValuations(): Promise<CompanyValuation[]> {
  const sb = createPublicClient();

  const [{ data: funds }, { data: instr }, { data: lastDateRow }, { data: divs }] = await Promise.all([
    sb.from('fundamentals').select('code, year, revenue, net_income, equity, cash, debt'),
    sb.from('brvm_instruments').select('code, designation, secteur, shares').eq('actif', true),
    sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
    sb.from('dividends').select('code, montant, exercice').order('exercice', { ascending: false }),
  ]);

  const lastDate = (lastDateRow as { date_marche: string }[] | null)?.[0]?.date_marche ?? null;
  const priceByCode = new Map<string, number>();
  if (lastDate) {
    const { data: prices } = await sb.from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate);
    for (const p of (prices ?? []) as { code: string; cours_jour: number | null }[]) {
      if (p.cours_jour != null) priceByCode.set(p.code, p.cours_jour);
    }
  }

  const fundsByCode = new Map<string, FundRow[]>();
  for (const f of (funds ?? []) as FundRow[]) {
    if (!fundsByCode.has(f.code)) fundsByCode.set(f.code, []);
    fundsByCode.get(f.code)!.push(f);
  }

  const instrByCode = new Map<string, { designation: string | null; secteur: string; shares: number | null }>();
  for (const i of (instr ?? []) as { code: string; designation: string | null; secteur: string | null; shares: number | null }[]) {
    instrByCode.set(i.code, { designation: i.designation, secteur: i.secteur ?? 'Autres', shares: i.shares });
  }

  const divByCode = new Map<string, number>();
  // Le plus récent STRICTEMENT POSITIF et daté par son exercice (comme `dividendeCourant`) :
  // un zéro ou une ligne sans exercice ne doit pas masquer un vrai dividende.
  for (const d of (divs ?? []) as { code: string; montant: number; exercice: number | null }[]) {
    if (!divByCode.has(d.code) && d.montant > 0 && d.exercice != null) divByCode.set(d.code, d.montant);
  }

  // 1re passe : métriques par société.
  type Pre = { code: string; designation: string | null; secteur: string; price: number | null; shares: number | null; metrics: ValuationMetrics; dps: number | null; revGrowthDiv: number | null; annee: number | null };
  const pre: Pre[] = [];
  for (const [code, rows] of fundsByCode) {
    const meta = instrByCode.get(code);
    if (!meta) continue;
    const picked = pickLatest(rows);
    if (!picked) continue;
    const price = priceByCode.get(code) ?? null;
    const dps = divByCode.get(code) ?? null;
    const metrics = computeMetrics({ current: picked.current, previous: picked.previous, price, shares: meta.shares, dividendPerShare: dps });
    pre.push({ code, designation: meta.designation, secteur: meta.secteur, price, shares: meta.shares, metrics, dps, revGrowthDiv: metrics.netIncomeGrowth, annee: picked.current.year });
  }

  // Médianes sectorielles (P/E, P/B), repli marché si < 3 pairs. La société
  // évaluée est EXCLUE de ses pairs (B2, 2026-11-13) : SCRC, ROE −35,6 %, était
  // la médiane P/B de son propre secteur et ressortait « juste prix ».
  // Les comparables passent les mêmes exclusions que la société évaluée
  // (comparableRetenu) : aucun ratio aberrant ni compte périmé dans une médiane.
  const anneeCourante = new Date().getUTCFullYear();
  function sectorMedian(secteur: string, key: 'per' | 'pbr', code: string): number | null {
    const valides = pre.filter((p) => p.code !== code && comparableRetenu(key, p.metrics, p.annee, anneeCourante, AGE_MAX_EXERCICE));
    const peers = valides.filter((p) => p.secteur === secteur);
    if (peers.length >= 3) return median(peers.map((p) => p.metrics[key]));
    return median(valides.map((p) => p.metrics[key]));
  }

  // 2e passe : juste-valeur + qualité + verdict.
  return pre.map((p) => {
    const fairValue = computeFairValue({
      eps: p.metrics.eps, bvps: p.metrics.bvps, price: p.price,
      peers: { medianPER: sectorMedian(p.secteur, 'per', p.code), medianPBR: sectorMedian(p.secteur, 'pbr', p.code) },
      dividendPerShare: p.dps, dividendGrowth: 0,
      roe: p.metrics.roe, per: p.metrics.per,
    });
    const quality = computeQuality(p.metrics);
    const tropAncien = p.annee == null || p.annee < anneeCourante - AGE_MAX_EXERCICE;
    const verdict = buildVerdict(p.metrics, fairValue, quality, { annee: p.annee, tropAncien });
    return { code: p.code, designation: p.designation, secteur: p.secteur, price: p.price, shares: p.shares, metrics: p.metrics, fairValue, quality, verdict };
  });
}

/** Valorisation d'une société (réutilise le calcul marché pour les médianes pairs). */
export async function getValuation(code: string): Promise<CompanyValuation | null> {
  const all = await getMarketValuations();
  return all.find((c) => c.code === code) ?? null;
}
