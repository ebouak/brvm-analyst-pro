import { describe, it, expect } from 'vitest';
import { assembleDcf, netDebtOf, costOfDebtOf, fcfCagr, type AssembleRawInputs, type AssembleAssumptions } from './assemble';

describe('helpers dérivés', () => {
  it('netDebtOf = dette − trésorerie ; null si tout manque', () => {
    expect(netDebtOf(1000, 300)).toBe(700);
    expect(netDebtOf(null, 300)).toBe(-300);
    expect(netDebtOf(null, null)).toBeNull();
  });

  it('costOfDebtOf = charges / dette ; null si dette ≤ 0 ou inconnue', () => {
    expect(costOfDebtOf(80, 1000)).toBeCloseTo(0.08, 10);
    expect(costOfDebtOf(80, 0)).toBeNull();
    expect(costOfDebtOf(null, 1000)).toBeNull();
  });

  it('fcfCagr ; null si signe non monotone ou < 2 points', () => {
    expect(fcfCagr([100, 121])).toBeCloseTo(0.21, 10);
    expect(fcfCagr([100])).toBeNull();
    expect(fcfCagr([-100, 121])).toBeNull();
  });
});

const raw: AssembleRawInputs = {
  cours: 5000,
  shares: 1000,
  fcfHistory: [800, 900, 1000],
  totalDebt: 2000,
  cash: 500,
  interestExpense: 160,
  equityRiskPremium: 0.0813, // Côte d'Ivoire (Damodaran)
  countryRiskPremium: 0.039,
  taxRate: 0.25,
};
const assumptions: AssembleAssumptions = {
  riskFree: 0.06,
  growthRate: 0.05,
  years: 5,
  terminalGrowth: 0.02,
  fallbackBeta: 1,
};

describe('assembleDcf', () => {
  it('dérive valeurs de marché, dette nette, Kd et produit une juste-valeur', () => {
    const r = assembleDcf({ ...raw, stockPrices: undefined, marketPrices: undefined }, assumptions);
    expect(r.marketValueEquity).toBe(5_000_000); // 5000 × 1000
    expect(r.netDebt).toBe(1500); // 2000 − 500
    expect(r.costOfDebtPreTax).toBeCloseTo(0.08, 10); // 160 / 2000
    expect(r.betaEstimated).toBe(true); // pas de prix fournis
    expect(r.betaUsed).toBe(1);
    expect(r.dcf?.fairValuePerShare).not.toBeNull();
    expect(r.sensitivity).toHaveLength(3);
  });

  it('utilise le bêta régressé quand l historique de prix est fourni', () => {
    // Rendements marché alternés ; rendements titre = 2× → β = 2.
    const mktReturns = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.02));
    const pricesFromReturns = (rets: number[], p0 = 100) => {
      const prices = [p0];
      for (const ret of rets) prices.push(prices[prices.length - 1] * (1 + ret));
      return prices;
    };
    const market = pricesFromReturns(mktReturns);
    const stock = pricesFromReturns(mktReturns.map((m) => m * 2));
    const r = assembleDcf({ ...raw, stockPrices: stock, marketPrices: market }, assumptions);
    expect(r.betaEstimated).toBe(false);
    expect(r.beta.beta).toBeCloseTo(2, 6);
    expect(r.betaUsed).toBeCloseTo(2, 6);
  });

  it('betaOverride est prioritaire sur la régression et le repli', () => {
    const market = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.02));
    const px = (rets: number[], p0 = 100) => {
      const p = [p0];
      for (const r of rets) p.push(p[p.length - 1] * (1 + r));
      return p;
    };
    const r = assembleDcf(
      { ...raw, stockPrices: px(market), marketPrices: px(market) }, // régression → β≈1
      { ...assumptions, betaOverride: 1.5 },
    );
    expect(r.betaUsed).toBe(1.5);
    expect(r.betaEstimated).toBe(false);
    expect(r.notes.some((n) => n.includes('manuellement'))).toBe(true);
  });

  it('N INVENTE RIEN : aucun FCF → pas de DCF, note explicite', () => {
    const r = assembleDcf({ ...raw, fcfHistory: [] }, assumptions);
    expect(r.baseFcf).toBeNull();
    expect(r.dcf).toBeNull();
    expect(r.upside).toBeNull();
    expect(r.notes.some((n) => n.includes('non calculable'))).toBe(true);
  });

  it('N INVENTE RIEN : Kd non dérivable → WACC = coût des fonds propres + note', () => {
    const r = assembleDcf({ ...raw, interestExpense: null, stockPrices: undefined, marketPrices: undefined }, assumptions);
    expect(r.costOfDebtPreTax).toBeNull();
    expect(r.wacc.wacc).toBeCloseTo(r.wacc.costOfEquity, 10);
    expect(r.notes.some((n) => n.includes('coût des fonds propres'))).toBe(true);
  });
});
