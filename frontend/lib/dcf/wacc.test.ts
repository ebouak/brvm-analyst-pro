import { describe, it, expect } from 'vitest';
import { costOfEquity, computeWacc } from './wacc';
import type { WaccInputs } from './types';

describe('costOfEquity (MEDAF + risque pays)', () => {
  it('Ke = rf + β·ERP + CRP', () => {
    // 0.06 + 1.2*0.055 + 0.03 = 0.156
    expect(costOfEquity(0.06, 1.2, 0.055, 0.03)).toBeCloseTo(0.156, 10);
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
  it('pondère Ke et Kd après impôt selon E/V et D/V', () => {
    const r = computeWacc(base);
    // Ke = 0.06 + 0.05 + 0.02 = 0.13 ; Kd(1-t) = 0.08*0.75 = 0.06
    // WACC = 0.8*0.13 + 0.2*0.06 = 0.116
    expect(r.costOfEquity).toBeCloseTo(0.13, 10);
    expect(r.costOfDebtAfterTax).toBeCloseTo(0.06, 10);
    expect(r.weightEquity).toBeCloseTo(0.8, 10);
    expect(r.weightDebt).toBeCloseTo(0.2, 10);
    expect(r.wacc).toBeCloseTo(0.116, 10);
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
