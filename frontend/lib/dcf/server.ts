import { createPublicClient } from '@/lib/supabase/public';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { yieldToMaturity, yearsTo, parseObligationDesignation } from '@/lib/bonds';
import { fcfCagr, type AssembleRawInputs, type AssembleAssumptions } from './assemble';

/** Code de l'indice composite BRVM (marché de référence pour le bêta). */
const MARKET_INDEX_CODE = 'BRVMC';
/** Pays par défaut (siège BRVM, majorité des cotées) — surchargeable côté UI. */
const DEFAULT_COUNTRY = "Côte d'Ivoire";

export interface RiskPremiumRow {
  pays: string;
  moody_rating: string | null;
  equity_risk_prem: number;
  country_risk_prem: number;
  taux_is: number | null;
}

export interface DcfPageData {
  code: string;
  designation: string | null;
  secteur: string | null;
  raw: AssembleRawInputs;
  defaults: AssembleAssumptions;
  meta: {
    riskFreeSource: 'souverain' | 'repli';
    riskPremiumCountry: string;
    moodyRating: string | null;
    betaObs: number;
    fcfYears: number;
    available: boolean; // au moins un FCF + actions
    /** FCF approché par le résultat net (flux détaillés indisponibles). */
    fcfProxy: boolean;
  };
  /** Liste des pays disponibles pour le sélecteur de prime de risque. */
  countries: RiskPremiumRow[];
}

/** Dérive le FCF d'une ligne de flux : disponible direct, sinon exploitation − capex. */
function deriveFcf(cf: {
  flux_tresorerie_disponible: number | null;
  flux_exploitation: number | null;
  depenses_capital: number | null;
  investissements_ppe: number | null;
}): number | null {
  if (cf.flux_tresorerie_disponible != null) return cf.flux_tresorerie_disponible;
  const capex = cf.depenses_capital ?? cf.investissements_ppe;
  if (cf.flux_exploitation != null && capex != null) return cf.flux_exploitation - Math.abs(capex);
  return null;
}

/** Taux sans risque = YTM de l'obligation souveraine la plus longue (réel), sinon null. */
async function getSovereignRiskFree(): Promise<number | null> {
  const supabase = createPublicClient();
  const { data: lastRow } = await supabase
    .from('brvm_obligations_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return null;

  const { data } = await supabase
    .from('brvm_obligations_daily')
    .select('designation, emetteur, taux_pct, maturite, cours_jour')
    .eq('date_marche', lastDate);

  let bestYears = -1;
  let bestYtm: number | null = null;
  for (const o of (data ?? []) as {
    designation: string | null;
    emetteur: string | null;
    taux_pct: number | null;
    maturite: string | null;
    cours_jour: number | null;
  }[]) {
    const parsed = parseObligationDesignation(o.designation);
    const emetteur = (o.emetteur ?? parsed.emetteur ?? '').toLowerCase();
    // Émetteurs souverains : « État du … », « Trésor public … ».
    if (!/(etat|état|tr[eé]sor)/.test(emetteur)) continue;
    const tauxPct = o.taux_pct ?? parsed.couponPct;
    const maturite = o.maturite ?? parsed.maturite;
    const years = yearsTo(maturite);
    if (o.cours_jour == null || tauxPct == null || years == null) continue;
    const ytm = yieldToMaturity({ prix: o.cours_jour, couponRatePct: tauxPct, yearsToMaturity: years, face: 100 });
    if (ytm != null && years > bestYears) {
      bestYears = years;
      bestYtm = ytm / 100; // % → décimal
    }
  }
  return bestYtm;
}

/** Séries de prix titre + indice alignées par date (du plus ancien au plus récent). */
async function getAlignedSeries(code: string): Promise<{ stock: number[]; market: number[] }> {
  const supabase = createPublicClient();
  const [stockRes, idxRes] = await Promise.all([
    supabase
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour')
      .eq('code', code)
      .order('date_marche', { ascending: true })
      .limit(400),
    supabase
      .from('brvm_indices_daily')
      .select('date_marche, valeur')
      .eq('code', MARKET_INDEX_CODE)
      .order('date_marche', { ascending: true })
      .limit(400),
  ]);

  const idxByDate = new Map<string, number>();
  for (const r of (idxRes.data ?? []) as { date_marche: string; valeur: number | null }[]) {
    if (r.valeur != null && r.valeur > 0) idxByDate.set(r.date_marche, r.valeur);
  }
  const stock: number[] = [];
  const market: number[] = [];
  for (const r of (stockRes.data ?? []) as { date_marche: string; cours_jour: number | null }[]) {
    const idx = idxByDate.get(r.date_marche);
    if (r.cours_jour != null && r.cours_jour > 0 && idx != null) {
      stock.push(r.cours_jour);
      market.push(idx);
    }
  }
  return { stock, market };
}

export async function getDcfData(code: string): Promise<DcfPageData | null> {
  const supabase = createPublicClient();
  const fin = await loadCompanyFinancials(code);
  if (!fin) return null;

  const [{ stock, market }, sovereignRf, premiumsRes] = await Promise.all([
    getAlignedSeries(code),
    getSovereignRiskFree(),
    supabase
      .from('risk_premiums')
      .select('pays, moody_rating, equity_risk_prem, country_risk_prem, taux_is')
      .order('equity_risk_prem', { ascending: true }),
  ]);

  const countries = (premiumsRes.data ?? []) as RiskPremiumRow[];
  const country = countries.find((c) => c.pays === DEFAULT_COUNTRY) ?? countries[0] ?? null;

  // FCF history (du plus ancien au plus récent). Priorité aux flux réels ;
  // à défaut (flux détaillés vides), proxy = résultat net réel par exercice,
  // explicitement étiqueté (N'INVENTE RIEN : le résultat net est une donnée réelle).
  const netIncomeByPeriode = new Map<string, number>();
  for (const inc of fin.incomeStatements) {
    if (inc.resultat_net != null) netIncomeByPeriode.set(inc.periode, inc.resultat_net);
  }
  let fcfProxy = false;
  const fcfHistory = [...fin.cashFlowStatements]
    .reverse()
    .map((cf) => {
      const real = deriveFcf(cf);
      if (real != null) return real;
      const proxy = netIncomeByPeriode.get(cf.periode);
      if (proxy != null) {
        fcfProxy = true;
        return proxy;
      }
      return null;
    })
    .filter((v): v is number => v != null);

  // Si aucune ligne de flux mais des résultats nets existent, bâtir l'historique
  // directement depuis le résultat net (cas où cash_flow_statements est absent).
  if (fcfHistory.length === 0 && netIncomeByPeriode.size > 0) {
    const periodes = [...netIncomeByPeriode.keys()].sort();
    for (const p of periodes) fcfHistory.push(netIncomeByPeriode.get(p)!);
    fcfProxy = true;
  }

  const latestBalance = fin.balanceSheets[0];
  const latestIncome = fin.incomeStatements[0];
  const totalDebt =
    latestBalance && (latestBalance.dette_long_terme != null || latestBalance.dette_court_terme != null)
      ? (latestBalance.dette_long_terme ?? 0) + (latestBalance.dette_court_terme ?? 0)
      : null;
  const cash = latestBalance?.tresorerie_equivalents ?? null;
  const interestExpense = latestIncome?.charges_financieres_nettes ?? null;
  const shares = fin.instrument.shares ?? latestIncome?.actions_en_circulation ?? null;
  const cours = fin.latestDaily?.cours_jour ?? null;

  const erp = country?.equity_risk_prem ?? 0.0813;
  const crp = country?.country_risk_prem ?? 0.039;
  const taxRate = country?.taux_is ?? 0.25;

  const raw: AssembleRawInputs = {
    cours,
    shares,
    fcfHistory,
    totalDebt,
    cash,
    interestExpense,
    stockPrices: stock.length > 0 ? stock : undefined,
    marketPrices: market.length > 0 ? market : undefined,
    equityRiskPremium: erp,
    countryRiskPremium: crp,
    taxRate,
  };

  // Croissance par défaut = CAGR historique des FCF, borné [0 %, 12 %] (prudence).
  const cagr = fcfCagr(fcfHistory);
  const growthDefault = cagr == null ? 0.05 : Math.max(0, Math.min(0.12, cagr));

  const defaults: AssembleAssumptions = {
    riskFree: sovereignRf ?? 0.06,
    growthRate: growthDefault,
    years: 5,
    terminalGrowth: 0.02,
    fallbackBeta: 1.0,
  };

  return {
    code: fin.instrument.code,
    designation: fin.instrument.designation,
    secteur: fin.instrument.secteur,
    raw,
    defaults,
    meta: {
      riskFreeSource: sovereignRf != null ? 'souverain' : 'repli',
      riskPremiumCountry: country?.pays ?? DEFAULT_COUNTRY,
      moodyRating: country?.moody_rating ?? null,
      betaObs: Math.max(0, Math.min(stock.length, market.length) - 1),
      fcfYears: fcfHistory.length,
      available: fcfHistory.length > 0 && shares != null && shares > 0,
      fcfProxy,
    },
    countries,
  };
}
