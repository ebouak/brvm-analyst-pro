import type { IncomeStatement, BalanceSheet, CashFlowStatement, FundamentalRatios } from './types';

export interface FundamentalsParams {
  coursActuel: number | null;
  shares: number | null;
  cours_bas_52s: number | null;
  cours_haut_52s: number | null;
  income: IncomeStatement | null;
  incomePrev: IncomeStatement | null;
  balance: BalanceSheet | null;
  cashflow: CashFlowStatement | null;
}

function safe(a: number | null, b: number | null, fn: (a: number, b: number) => number): number | null {
  if (a == null || b == null || b === 0) return null;
  return fn(a, b);
}

export function calculateFundamentals(p: FundamentalsParams): FundamentalRatios {
  const cours = p.coursActuel;
  const shares = p.shares;
  const inc = p.income;
  const incPrev = p.incomePrev;
  const bal = p.balance;

  const capitalisation = cours != null && shares != null ? cours * shares : null;
  const bpa = inc?.benefice_par_action ?? null;
  const rendement_dividende = safe(inc?.dividende_par_action ?? null, cours, (d, c) => (d / c) * 100);
  const per = safe(cours, bpa, (c, b) => c / b);
  const pb = capitalisation != null && bal?.total_capitaux_propres
    ? safe(capitalisation, bal.total_capitaux_propres, (a, b) => a / b)
    : null;
  const ps = capitalisation != null && inc?.revenu_total
    ? safe(capitalisation, inc.revenu_total, (a, b) => a / b)
    : null;
  const roe = safe(inc?.resultat_net ?? null, bal?.total_capitaux_propres ?? null, (n, cp) => (n / cp) * 100);
  const marge_nette = safe(inc?.resultat_net ?? null, inc?.revenu_total ?? null, (n, r) => (n / r) * 100);

  const dette_court = bal?.dette_court_terme ?? null;
  const dette_long = bal?.dette_long_terme ?? null;
  const dette_totale = dette_court != null && dette_long != null ? dette_court + dette_long : null;
  const dette_sur_capitaux_propres = safe(dette_totale, bal?.total_capitaux_propres ?? null, (d, cp) => d / cp);

  const payout = (inc?.dividende_par_action != null && inc?.actions_en_circulation != null && inc?.resultat_net != null && inc.resultat_net !== 0)
    ? ((inc.dividende_par_action * inc.actions_en_circulation) / inc.resultat_net) * 100
    : null;

  const croissance_ca = (inc?.revenu_total != null && incPrev?.revenu_total != null && incPrev.revenu_total !== 0)
    ? ((inc.revenu_total - incPrev.revenu_total) / Math.abs(incPrev.revenu_total)) * 100
    : null;
  const croissance_rn = (inc?.resultat_net != null && incPrev?.resultat_net != null && incPrev.resultat_net !== 0)
    ? ((inc.resultat_net - incPrev.resultat_net) / Math.abs(incPrev.resultat_net)) * 100
    : null;

  return {
    capitalisation,
    bpa,
    rendement_dividende,
    per,
    pb,
    ps,
    roe,
    marge_nette,
    dette_sur_capitaux_propres,
    payout,
    croissance_ca,
    croissance_rn,
    cours_bas_52s: p.cours_bas_52s,
    cours_haut_52s: p.cours_haut_52s,
    cours_actuel: cours,
  };
}
