import { describe, it, expect } from 'vitest';
import { computeRedFlags } from './redFlags';
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import type { DiagnosticMetrics } from './metrics';

function emptyMetrics(): DiagnosticMetrics {
  return {
    ebitda_n: null, ebitda_n1: null, marge_ebitda_n: null, marge_ebitda_n1: null,
    marge_ebit_n: null, marge_ebit_n1: null, marge_brute_n: null, marge_brute_n1: null,
    marge_nette_n: null, marge_nette_n1: null, roce: null,
    dupont_marge: null, dupont_rotation: null, dupont_levier: null, roe_dupont: null,
    current_ratio: null, quick_ratio: null, cash_ratio: null,
    bfr_n: null, bfr_n1: null, bfr_jours: null,
    net_debt_n: null, net_debt_n1: null, interest_cover: null, debt_ebitda: null,
    fcf_n: null, fcf_n1: null, fcf_yield: null, cf_conversion: null, capex_n: null, capex_ca: null,
    ev_n: null, ev_ebitda: null, ev_ebit: null, ev_ca: null,
    payout_ratio: null, div_cover: null, fcf_div_cover: null,
    altman_z: null,
    cagr_ca: null, cagr_rn: null, cagr_ebitda: null,
  };
}

function baseParams() {
  return {
    inc_n: null as IncomeStatement | null,
    inc_n1: null as IncomeStatement | null,
    bal_n: null as BalanceSheet | null,
    bal_n1: null as BalanceSheet | null,
    cf_n: null as CashFlowStatement | null,
    cf_n1: null as CashFlowStatement | null,
    m: emptyMetrics(),
  };
}

function check(id: string, checks: ReturnType<typeof computeRedFlags>['checks']) {
  const c = checks.find((x) => x.id === id);
  if (!c) throw new Error(`check ${id} not found`);
  return c;
}

describe('computeRedFlags', () => {
  it('effet_ciseaux: déclenché quand CA en hausse et RN en baisse', () => {
    const p = baseParams();
    p.m = { ...p.m, cagr_ca: 8.2, cagr_rn: -14.6 };
    const c = check('effet_ciseaux', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(true);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBeGreaterThan(0);
  });

  it('effet_ciseaux: non déclenché quand CA et RN progressent ensemble', () => {
    const p = baseParams();
    p.m = { ...p.m, cagr_ca: 8.2, cagr_rn: 5.0 };
    const c = check('effet_ciseaux', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(true);
    expect(c.triggered).toBe(false);
    expect(c.severity).toBe(0);
  });

  it('effet_ciseaux: dataAvailable false si croissance non calculable', () => {
    const p = baseParams();
    const c = check('effet_ciseaux', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
    expect(c.triggered).toBe(false);
  });

  it('compression_marges: déclenché quand la marge EBITDA recule', () => {
    const p = baseParams();
    p.m = { ...p.m, marge_ebitda_n: 12, marge_ebitda_n1: 20, marge_brute_n: 40, marge_brute_n1: 40 };
    const c = check('compression_marges', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(8);
  });

  it('compression_marges: non déclenché quand les marges progressent', () => {
    const p = baseParams();
    p.m = { ...p.m, marge_ebitda_n: 22, marge_ebitda_n1: 20, marge_brute_n: 41, marge_brute_n1: 40 };
    const c = check('compression_marges', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('compression_marges: dataAvailable false si aucune marge connue sur les 2 périodes', () => {
    const p = baseParams();
    const c = check('compression_marges', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('divergence_cash: déclenché quand RN positif mais flux d\'exploitation négatif (précédent BNBC)', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), resultat_net: 500_000_000 };
    p.cf_n = { ...({} as CashFlowStatement), flux_exploitation: -200_000_000 };
    p.m = { ...p.m, fcf_n: -300_000_000 };
    const c = check('divergence_cash', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(9);
  });

  it('divergence_cash: non déclenché quand RN et cash sont positifs', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), resultat_net: 500_000_000 };
    p.cf_n = { ...({} as CashFlowStatement), flux_exploitation: 600_000_000 };
    p.m = { ...p.m, fcf_n: 100_000_000 };
    const c = check('divergence_cash', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('divergence_cash: dataAvailable false si résultat net inconnu', () => {
    const p = baseParams();
    const c = check('divergence_cash', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('dette_cachee: déclenché quand le BFR est élevé et la dette LT affichée faible (précédent ONTBF)', () => {
    const p = baseParams();
    p.bal_n = { ...({} as BalanceSheet), dette_long_terme: 100_000_000 };
    p.m = { ...p.m, bfr_jours: 150, bfr_n: 1_000_000_000 };
    const c = check('dette_cachee', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(10);
  });

  it('dette_cachee: non déclenché quand le BFR est faible', () => {
    const p = baseParams();
    p.bal_n = { ...({} as BalanceSheet), dette_long_terme: 100_000_000 };
    p.m = { ...p.m, bfr_jours: 30, bfr_n: 200_000_000 };
    const c = check('dette_cachee', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('dette_cachee: dataAvailable false si BFR non calculable', () => {
    const p = baseParams();
    const c = check('dette_cachee', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('dividende_non_couvert: déclenché quand payout élevé et fcf_div_cover < 1', () => {
    const p = baseParams();
    p.m = { ...p.m, payout_ratio: 80, fcf_div_cover: -0.5 };
    const c = check('dividende_non_couvert', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(8);
  });

  it('dividende_non_couvert: la sévérité croît quand la couverture FCF se dégrade (monotonicité)', () => {
    const pMild = baseParams();
    pMild.m = { ...pMild.m, payout_ratio: 80, fcf_div_cover: -0.1 };
    const severityMild = check('dividende_non_couvert', computeRedFlags(pMild).checks).severity;

    const pSevere = baseParams();
    pSevere.m = { ...pSevere.m, payout_ratio: 80, fcf_div_cover: -2 };
    const severitySevere = check('dividende_non_couvert', computeRedFlags(pSevere).checks).severity;

    expect(severitySevere).toBeGreaterThan(severityMild);
  });

  it('dividende_non_couvert: non déclenché quand le FCF couvre largement le dividende', () => {
    const p = baseParams();
    p.m = { ...p.m, payout_ratio: 80, fcf_div_cover: 2.5 };
    const c = check('dividende_non_couvert', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('dividende_non_couvert: dataAvailable false si payout inconnu', () => {
    const p = baseParams();
    const c = check('dividende_non_couvert', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('tension_liquidite: déclenché quand le quick ratio est sous 1', () => {
    const p = baseParams();
    p.m = { ...p.m, quick_ratio: 0.5 };
    const c = check('tension_liquidite', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(10);
  });

  it('tension_liquidite: non déclenché quand le quick ratio est confortable', () => {
    const p = baseParams();
    p.m = { ...p.m, quick_ratio: 1.4 };
    const c = check('tension_liquidite', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('tension_liquidite: dataAvailable false si quick ratio inconnu', () => {
    const p = baseParams();
    const c = check('tension_liquidite', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('detresse_altman: déclenché en zone de détresse (<1.1)', () => {
    const p = baseParams();
    p.m = { ...p.m, altman_z: 0.8 };
    const c = check('detresse_altman', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(10);
  });

  it('detresse_altman: non déclenché en zone saine (>2.6)', () => {
    const p = baseParams();
    p.m = { ...p.m, altman_z: 3.2 };
    const c = check('detresse_altman', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('detresse_altman: dataAvailable false si Altman Z\' inconnu', () => {
    const p = baseParams();
    const c = check('detresse_altman', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('dilution: déclenché quand les actions en circulation augmentent de plus de 2%', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), actions_en_circulation: 1_100_000 };
    p.inc_n1 = { ...({} as IncomeStatement), actions_en_circulation: 1_000_000 };
    const c = check('dilution', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(10);
  });

  it('dilution: non déclenché quand le nombre d\'actions est stable', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), actions_en_circulation: 1_000_500 };
    p.inc_n1 = { ...({} as IncomeStatement), actions_en_circulation: 1_000_000 };
    const c = check('dilution', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('dilution: dataAvailable false si le nombre d\'actions en circulation est manquant sur une période (champ nullable)', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), actions_en_circulation: null };
    p.inc_n1 = { ...({} as IncomeStatement), actions_en_circulation: 1_000_000 };
    const c = check('dilution', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('overallScore : déterministe (mêmes entrées → même score)', () => {
    const p = baseParams();
    p.m = { ...p.m, cagr_ca: 8.2, cagr_rn: -14.6, altman_z: 0.8, quick_ratio: 0.5 };
    const r1 = computeRedFlags(p).overallScore;
    const r2 = computeRedFlags(p).overallScore;
    expect(r1).toBe(r2);
    expect(r1).not.toBeNull();
  });

  it('overallScore : null quand aucun check n\'a de données', () => {
    const p = baseParams();
    expect(computeRedFlags(p).overallScore).toBeNull();
  });
});
