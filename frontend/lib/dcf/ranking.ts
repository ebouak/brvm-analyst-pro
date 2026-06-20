import { createPublicClient } from '@/lib/supabase/public';
import { assembleDcf, fcfCagr, type AssembleRawInputs } from './assemble';

/**
 * Classement DCF du marché : juste-valeur par flux actualisés pour toutes les
 * actions, calculée en BULK (peu de requêtes) avec des hypothèses par défaut
 * (rf de repli, bêta 1.0, primes de risque Côte d'Ivoire). C'est un outil de
 * SCREENING : la fiche par action reste la référence (bêta réel, rf souverain,
 * hypothèses ajustables). N'INVENTE RIEN : `mode='na'` si non calculable.
 */
export interface DcfRankRow {
  code: string;
  designation: string | null;
  secteur: string | null;
  cours: number | null;
  fairValue: number | null;
  upside: number | null; // (fair − cours)/cours
  mode: 'reel' | 'proxy' | 'na';
}

const DEFAULT_RF = 0.06;
const DEFAULT_BETA = 1.0;

type Row = Record<string, number | string | null>;

function deriveFcf(cf: Row | undefined): number | null {
  if (!cf) return null;
  const disp = cf.flux_tresorerie_disponible as number | null;
  if (disp != null) return disp;
  const exp = cf.flux_exploitation as number | null;
  const capex = (cf.depenses_capital as number | null) ?? (cf.investissements_ppe as number | null);
  if (exp != null && capex != null) return exp - Math.abs(capex);
  return null;
}

/** Dernière entrée (par `periode` croissante) d'une map code→liste. */
function latest<T extends { periode: string }>(rows: T[]): T | undefined {
  return rows.length ? rows[rows.length - 1] : undefined;
}

export async function getDcfRanking(): Promise<DcfRankRow[]> {
  const sb = createPublicClient();

  const [{ data: instruments }, lastRowRes, incRes, balRes, cfRes, premRes] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation, secteur, shares').eq('type', 'action'),
    sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
    sb.from('income_statements').select('code, periode, resultat_net, actions_en_circulation').eq('type_periode', 'annuel').order('periode', { ascending: true }),
    sb.from('balance_sheets').select('code, periode, dette_long_terme, dette_court_terme, tresorerie_equivalents').eq('type_periode', 'annuel').order('periode', { ascending: true }),
    sb.from('cash_flow_statements').select('code, periode, flux_tresorerie_disponible, flux_exploitation, depenses_capital, investissements_ppe').eq('type_periode', 'annuel').order('periode', { ascending: true }),
    sb.from('risk_premiums').select('equity_risk_prem, country_risk_prem, taux_is').eq('pays', "Côte d'Ivoire").maybeSingle(),
  ]);

  // Derniers cours
  const lastDate = (lastRowRes.data?.[0]?.date_marche as string | undefined) ?? null;
  const coursByCode = new Map<string, number>();
  if (lastDate) {
    const { data: px } = await sb.from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate);
    for (const r of (px ?? []) as { code: string; cours_jour: number | null }[]) {
      if (r.cours_jour != null) coursByCode.set(r.code, r.cours_jour);
    }
  }

  // Regroupement par code
  const groupBy = <T extends { code: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) (m.get(r.code) ?? m.set(r.code, []).get(r.code)!).push(r);
    return m;
  };
  const incByCode = groupBy(incRes.data as ({ code: string; periode: string; resultat_net: number | null; actions_en_circulation: number | null })[] | null);
  const balByCode = groupBy(balRes.data as ({ code: string; periode: string } & Row)[] | null);
  const cfByCode = groupBy(cfRes.data as ({ code: string; periode: string } & Row)[] | null);

  const erp = (premRes.data?.equity_risk_prem as number | null) ?? 0.0813;
  const crp = (premRes.data?.country_risk_prem as number | null) ?? 0.039;
  const taxRate = (premRes.data?.taux_is as number | null) ?? 0.25;

  const rows: DcfRankRow[] = [];

  for (const inst of (instruments ?? []) as { code: string; designation: string | null; secteur: string | null; shares: number | null }[]) {
    const cours = coursByCode.get(inst.code) ?? null;
    const incList = (incByCode.get(inst.code) ?? []);
    const cfList = (cfByCode.get(inst.code) ?? []);
    const latestBal = latest(balByCode.get(inst.code) ?? []);

    // FCF réel (par exercice) sinon proxy résultat net.
    const realFcf = cfList.map((c) => deriveFcf(c)).filter((v): v is number => v != null);
    const netIncome = incList.map((i) => i.resultat_net).filter((v): v is number => v != null);
    let fcfHistory: number[] = [];
    let mode: DcfRankRow['mode'] = 'na';
    if (realFcf.length > 0) { fcfHistory = realFcf; mode = 'reel'; }
    else if (netIncome.length > 0) { fcfHistory = netIncome; mode = 'proxy'; }

    const shares = inst.shares ?? (latest(incList)?.actions_en_circulation ?? null);

    if (fcfHistory.length === 0 || shares == null || shares <= 0 || cours == null) {
      rows.push({ code: inst.code, designation: inst.designation, secteur: inst.secteur, cours, fairValue: null, upside: null, mode: 'na' });
      continue;
    }

    const totalDebt = latestBal && ((latestBal.dette_long_terme as number | null) != null || (latestBal.dette_court_terme as number | null) != null)
      ? ((latestBal.dette_long_terme as number | null) ?? 0) + ((latestBal.dette_court_terme as number | null) ?? 0)
      : null;
    const cash = (latestBal?.tresorerie_equivalents as number | null) ?? null;

    const raw: AssembleRawInputs = {
      cours, shares, fcfHistory,
      totalDebt, cash, interestExpense: null,
      equityRiskPremium: erp, countryRiskPremium: crp, taxRate,
    };
    const cagr = fcfCagr(fcfHistory);
    const growth = cagr == null ? 0.05 : Math.max(0, Math.min(0.12, cagr));
    const r = assembleDcf(raw, { riskFree: DEFAULT_RF, growthRate: growth, years: 5, terminalGrowth: 0.02, fallbackBeta: DEFAULT_BETA });

    rows.push({
      code: inst.code, designation: inst.designation, secteur: inst.secteur, cours,
      fairValue: r.dcf?.fairValuePerShare ?? null,
      upside: r.upside,
      mode: r.dcf?.fairValuePerShare != null ? mode : 'na',
    });
  }

  // Tri : décote la plus forte d'abord, les « na » à la fin.
  rows.sort((a, b) => {
    if (a.upside == null && b.upside == null) return 0;
    if (a.upside == null) return 1;
    if (b.upside == null) return -1;
    return b.upside - a.upside;
  });
  return rows;
}
