// frontend/lib/diagnostic/metrics.ts
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';

export interface DiagnosticMetrics {
  // Rentabilité
  ebitda_n: number | null;
  ebitda_n1: number | null;
  marge_ebitda_n: number | null;
  marge_ebitda_n1: number | null;
  marge_ebit_n: number | null;
  marge_ebit_n1: number | null;
  marge_brute_n: number | null;
  marge_brute_n1: number | null;
  marge_nette_n: number | null;
  marge_nette_n1: number | null;
  roce: number | null;
  // DuPont
  dupont_marge: number | null;
  dupont_rotation: number | null;
  dupont_levier: number | null;
  roe_dupont: number | null;
  // Liquidité
  current_ratio: number | null;
  quick_ratio: number | null;
  cash_ratio: number | null;
  // BFR
  bfr_n: number | null;
  bfr_n1: number | null;
  bfr_jours: number | null;
  // Dette
  net_debt_n: number | null;
  net_debt_n1: number | null;
  interest_cover: number | null;
  debt_ebitda: number | null;
  // Cash-flow
  fcf_n: number | null;
  fcf_n1: number | null;
  fcf_yield: number | null;
  cf_conversion: number | null;
  capex_n: number | null;
  capex_ca: number | null;
  // Valorisation
  ev_n: number | null;
  ev_ebitda: number | null;
  ev_ebit: number | null;
  ev_ca: number | null;
  // Dividende
  payout_ratio: number | null;
  div_cover: number | null;
  fcf_div_cover: number | null;
  // Altman Z'
  altman_z: number | null;
  // Croissance
  cagr_ca: number | null;
  cagr_rn: number | null;
  cagr_ebitda: number | null;
}

function s(a: number | null, b: number | null, fn: (a: number, b: number) => number): number | null {
  if (a == null || b == null || b === 0) return null;
  return fn(a, b);
}

export function computeDiagnosticMetrics(params: {
  inc_n: IncomeStatement | null;
  inc_n1: IncomeStatement | null;
  bal_n: BalanceSheet | null;
  bal_n1: BalanceSheet | null;
  cf_n: CashFlowStatement | null;
  cf_n1: CashFlowStatement | null;
  cours: number | null;
  capitalisation: number | null;
}): DiagnosticMetrics {
  const { inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, cours, capitalisation } = params;

  const ebitda_n = (inc_n?.resultat_exploitation != null && cf_n?.depreciation_amortissement != null)
    ? inc_n.resultat_exploitation + cf_n.depreciation_amortissement : null;
  const ebitda_n1 = (inc_n1?.resultat_exploitation != null && cf_n1?.depreciation_amortissement != null)
    ? inc_n1.resultat_exploitation + cf_n1.depreciation_amortissement : null;

  const marge_ebitda_n  = s(ebitda_n, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_ebitda_n1 = s(ebitda_n1, inc_n1?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_ebit_n    = s(inc_n?.resultat_exploitation ?? null, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_ebit_n1   = s(inc_n1?.resultat_exploitation ?? null, inc_n1?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_brute_n   = s(inc_n?.marge_brute ?? null, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_brute_n1  = s(inc_n1?.marge_brute ?? null, inc_n1?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_nette_n   = s(inc_n?.resultat_net ?? null, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_nette_n1  = s(inc_n1?.resultat_net ?? null, inc_n1?.revenu_total ?? null, (a, b) => (a / b) * 100);

  const capital_employe_n = (bal_n?.total_actifs != null && bal_n?.passif_courant != null)
    ? bal_n.total_actifs - bal_n.passif_courant : null;
  const roce = s(inc_n?.resultat_exploitation ?? null, capital_employe_n, (a, b) => (a / b) * 100);

  const actif_moy = (bal_n?.total_actifs != null && bal_n1?.total_actifs != null)
    ? (bal_n.total_actifs + bal_n1.total_actifs) / 2 : bal_n?.total_actifs ?? null;
  const cp_moy = (bal_n?.total_capitaux_propres != null && bal_n1?.total_capitaux_propres != null)
    ? (bal_n.total_capitaux_propres + bal_n1.total_capitaux_propres) / 2 : bal_n?.total_capitaux_propres ?? null;
  const dupont_marge    = s(inc_n?.resultat_net ?? null, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const dupont_rotation = s(inc_n?.revenu_total ?? null, actif_moy, (a, b) => a / b);
  const dupont_levier   = s(actif_moy, cp_moy, (a, b) => a / b);
  const roe_dupont = (dupont_marge != null && dupont_rotation != null && dupont_levier != null)
    ? (dupont_marge / 100) * dupont_rotation * dupont_levier * 100 : null;

  const current_ratio = s(bal_n?.total_actif_circulant ?? null, bal_n?.passif_courant ?? null, (a, b) => a / b);
  const quick_ratio = (bal_n?.total_actif_circulant != null && bal_n?.stocks != null && bal_n?.passif_courant != null && bal_n.passif_courant !== 0)
    ? (bal_n.total_actif_circulant - bal_n.stocks) / bal_n.passif_courant : null;
  const cash_ratio = s(bal_n?.tresorerie_equivalents ?? null, bal_n?.passif_courant ?? null, (a, b) => a / b);

  const bfr_n = (bal_n?.stocks != null && bal_n?.creances_clients != null && bal_n?.fournisseurs != null)
    ? bal_n.stocks + bal_n.creances_clients - bal_n.fournisseurs : null;
  const bfr_n1 = (bal_n1?.stocks != null && bal_n1?.creances_clients != null && bal_n1?.fournisseurs != null)
    ? bal_n1.stocks + bal_n1.creances_clients - bal_n1.fournisseurs : null;
  const bfr_jours = s(bfr_n, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 365);

  const dette_n = (bal_n?.dette_court_terme != null && bal_n?.dette_long_terme != null)
    ? bal_n.dette_court_terme + bal_n.dette_long_terme
    : bal_n?.dette_long_terme ?? null;
  const dette_n1 = (bal_n1?.dette_court_terme != null && bal_n1?.dette_long_terme != null)
    ? bal_n1.dette_court_terme + bal_n1.dette_long_terme
    : bal_n1?.dette_long_terme ?? null;
  const net_debt_n  = (dette_n != null && bal_n?.tresorerie_equivalents != null) ? dette_n - bal_n.tresorerie_equivalents : null;
  const net_debt_n1 = (dette_n1 != null && bal_n1?.tresorerie_equivalents != null) ? dette_n1 - bal_n1.tresorerie_equivalents : null;
  const interest_cover = (inc_n?.resultat_exploitation != null && inc_n?.charges_financieres_nettes != null && inc_n.charges_financieres_nettes !== 0)
    ? Math.abs(inc_n.resultat_exploitation / inc_n.charges_financieres_nettes) : null;
  const debt_ebitda = s(net_debt_n, ebitda_n, (a, b) => a / b);

  const fcf_n  = (cf_n?.flux_exploitation != null && cf_n?.flux_investissement != null) ? cf_n.flux_exploitation + cf_n.flux_investissement : null;
  const fcf_n1 = (cf_n1?.flux_exploitation != null && cf_n1?.flux_investissement != null) ? cf_n1.flux_exploitation + cf_n1.flux_investissement : null;
  const fcf_yield   = s(fcf_n, capitalisation, (a, b) => (a / b) * 100);
  const cf_conversion = s(cf_n?.flux_exploitation ?? null, inc_n?.resultat_net ?? null, (a, b) => a / b);

  const capex_n = (cf_n?.investissements_ppe != null)
    ? Math.abs(cf_n.investissements_ppe) + Math.abs(cf_n?.acquisitions ?? 0) : null;
  const capex_ca = s(capex_n, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);

  const ev_n = (capitalisation != null && net_debt_n != null) ? capitalisation + net_debt_n : null;
  const ev_ebitda = s(ev_n, ebitda_n, (a, b) => a / b);
  const ev_ebit   = s(ev_n, inc_n?.resultat_exploitation ?? null, (a, b) => a / b);
  const ev_ca     = s(ev_n, inc_n?.revenu_total ?? null, (a, b) => a / b);

  const div_total_n = (inc_n?.dividende_par_action != null && inc_n?.actions_en_circulation != null)
    ? inc_n.dividende_par_action * inc_n.actions_en_circulation : null;
  const payout_ratio   = s(div_total_n, inc_n?.resultat_net ?? null, (a, b) => (a / b) * 100);
  const div_cover      = s(inc_n?.resultat_net ?? null, div_total_n, (a, b) => a / b);
  const fcf_div_cover  = s(fcf_n, div_total_n, (a, b) => a / b);

  let altman_z: number | null = null;
  if (bal_n?.total_actifs && bal_n.total_actifs !== 0 && bal_n?.total_actif_circulant && bal_n?.passif_courant && bal_n?.total_capitaux_propres && inc_n?.resultat_exploitation) {
    const X1 = (bal_n.total_actif_circulant - bal_n.passif_courant) / bal_n.total_actifs;
    const X2 = (bal_n.reserves_benefices_non_repartis ?? 0) / bal_n.total_actifs;
    const X3 = inc_n.resultat_exploitation / bal_n.total_actifs;
    const dettes_totales = (bal_n.dette_court_terme ?? 0) + (bal_n.dette_long_terme ?? 0);
    const X4 = dettes_totales !== 0 ? bal_n.total_capitaux_propres / dettes_totales : null;
    if (X4 != null) altman_z = 6.56 * X1 + 3.26 * X2 + 6.72 * X3 + 1.05 * X4;
  }

  const cagr_ca    = s(inc_n?.revenu_total ?? null, inc_n1?.revenu_total ?? null, (a, b) => ((a - b) / Math.abs(b)) * 100);
  const cagr_rn    = s(inc_n?.resultat_net ?? null, inc_n1?.resultat_net ?? null, (a, b) => ((a - b) / Math.abs(b)) * 100);
  const cagr_ebitda = s(ebitda_n, ebitda_n1, (a, b) => ((a - b) / Math.abs(b)) * 100);

  return {
    ebitda_n, ebitda_n1, marge_ebitda_n, marge_ebitda_n1,
    marge_ebit_n, marge_ebit_n1, marge_brute_n, marge_brute_n1,
    marge_nette_n, marge_nette_n1, roce,
    dupont_marge, dupont_rotation, dupont_levier, roe_dupont,
    current_ratio, quick_ratio, cash_ratio,
    bfr_n, bfr_n1, bfr_jours,
    net_debt_n, net_debt_n1, interest_cover, debt_ebitda,
    fcf_n, fcf_n1, fcf_yield, cf_conversion, capex_n, capex_ca,
    ev_n, ev_ebitda, ev_ebit, ev_ca,
    payout_ratio, div_cover, fcf_div_cover,
    altman_z,
    cagr_ca, cagr_rn, cagr_ebitda,
  };
}
