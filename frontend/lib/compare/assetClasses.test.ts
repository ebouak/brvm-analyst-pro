import { describe, it, expect } from 'vitest';
import { annualizedReturnVol, toReturns, buildComparison } from './assetClasses';

describe('annualizedReturnVol', () => {
  it('annualise rendement et volatilité', () => {
    const { ret, vol } = annualizedReturnVol([0.001, 0.001, 0.001, 0.001]);
    expect(ret).toBeCloseTo(0.001 * 252, 5);
    expect(vol).toBeCloseTo(0, 5); // rendements constants => vol nulle
  });
  it('série trop courte => 0', () => {
    expect(annualizedReturnVol([0.01])).toEqual({ ret: 0, vol: 0 });
  });
});

describe('toReturns', () => {
  it('niveaux => rendements', () => {
    expect(toReturns([100, 110, 99])).toEqual([0.1, expect.closeTo(-0.1, 5)]);
  });
});

describe('buildComparison', () => {
  it('place les 4 classes avec sans-risque à vol 0', () => {
    const pts = buildComparison({
      marketReturns: [0.002, -0.001, 0.003, -0.002, 0.001, 0.002],
      obligationYtm: 0.065, obligationVol: null, dividendYield: 0.07, riskFreeRate: 0.06,
    });
    expect(pts.map((p) => p.kind)).toEqual(['marche', 'dividende', 'obligation', 'sans_risque']);
    const rf = pts.find((p) => p.kind === 'sans_risque')!;
    expect(rf.ret).toBe(0.06);
    expect(rf.vol).toBe(0);
    // dividende porte la volatilité de marché
    const market = pts.find((p) => p.kind === 'marche')!;
    const div = pts.find((p) => p.kind === 'dividende')!;
    expect(div.vol).toBe(market.vol);
  });

  it('omet obligations/dividende si non fournis', () => {
    const pts = buildComparison({ marketReturns: [0.01, 0.02], obligationYtm: null, obligationVol: null, dividendYield: null, riskFreeRate: 0.06 });
    expect(pts.map((p) => p.kind)).toEqual(['marche', 'sans_risque']);
  });
});
