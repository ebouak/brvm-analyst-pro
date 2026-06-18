import { describe, it, expect } from 'vitest';
import { costOfEquity, computeWacc } from './wacc';
import type { WaccInputs } from './types';

describe('costOfEquity (MEDAF, ERP total)', () => {
  it('Ke = rf + β·ERP_total (le CRP est déjà inclus dans l ERP, pas réajouté)', () => {
    // 0.06 + 1.2*0.0813 = 0.15756
    expect(costOfEquity(0.06, 1.2, 0.0813)).toBeCloseTo(0.15756, 10);
  });
});

const base: WaccInputs = {
  riskFree: 0.06,
  beta: 1,
  equityRiskPremium: 0.05,
  countryRiskPremium: 0.02,
  costOfDebtPreTax: 0.08,
  taxRate: 0.25,
  marketValueEquity: 800,
  marketValueDebt: 200,
};

describe('computeWacc', () => {
  it('pondère Ke et Kd après impôt selon E/V et D/V (CRP non réajouté)', () => {
    const r = computeWacc(base);
    // Ke = 0.06 + 1*0.05 = 0.11 (le CRP 0.02 n'est PAS réajouté) ; Kd(1-t) = 0.08*0.75 = 0.06
    // WACC = 0.8*0.11 + 0.2*0.06 = 0.10
    expect(r.costOfEquity).toBeCloseTo(0.11, 10);
    expect(r.costOfDebtAfterTax).toBeCloseTo(0.06, 10);
    expect(r.weightEquity).toBeCloseTo(0.8, 10);
    expect(r.weightDebt).toBeCloseTo(0.2, 10);
    expect(r.wacc).toBeCloseTo(0.1, 10);
  });

  it('N INVENTE RIEN : dette nulle → WACC = Ke, poids 100 % fonds propres', () => {
    const r = computeWacc({ ...base, marketValueDebt: 0 });
    expect(r.weightDebt).toBe(0);
    expect(r.wacc).toBeCloseTo(r.costOfEquity, 10);
  });

  it('N INVENTE RIEN : Kd inconnu → pas de branche dette fabriquée', () => {
    const r = computeWacc({ ...base, costOfDebtPreTax: null });
    expect(r.costOfDebtAfterTax).toBeNull();
    expect(r.wacc).toBeCloseTo(r.costOfEquity, 10);
  });
});
