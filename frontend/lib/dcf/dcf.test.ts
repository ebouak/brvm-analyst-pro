import { describe, it, expect } from 'vitest';
import { computeDcf, sensitivityMatrix } from './dcf';
import type { DcfInputs } from './types';

const base: DcfInputs = {
  baseFcf: 1000,
  growthRate: 0.05,
  years: 5,
  terminalGrowth: 0.02,
  wacc: 0.1,
  netDebt: 0,
  shares: 100,
};

describe('computeDcf (5 ans + valeur terminale)', () => {
  it('projette N années et actualise au WACC', () => {
    const r = computeDcf(base);
    expect(r.projectedFcf).toHaveLength(5);
    // FCF année 1 = 1000*1.05 = 1050
    expect(r.projectedFcf[0]).toBeCloseTo(1050, 6);
    // FCF année 5 = 1000*1.05^5
    expect(r.projectedFcf[4]).toBeCloseTo(1000 * 1.05 ** 5, 6);
    // discounted année 1 = 1050 / 1.1
    expect(r.discountedFcf[0]).toBeCloseTo(1050 / 1.1, 6);
  });

  it('calcule EV, equity et juste-valeur cohérents (valeur terminale > 0)', () => {
    const r = computeDcf(base);
    expect(r.terminalValue).toBeGreaterThan(0);
    expect(r.pvTerminal).toBeGreaterThan(0);
    expect(r.enterpriseValue).toBeCloseTo(
      r.discountedFcf.reduce((a, b) => a + b, 0) + r.pvTerminal,
      6,
    );
    // netDebt = 0 → equity = EV ; fairValue = equity / shares
    expect(r.equityValue).toBeCloseTo(r.enterpriseValue, 6);
    expect(r.fairValuePerShare).toBeCloseTo(r.equityValue / 100, 6);
  });

  it('soustrait la dette nette pour passer de EV à equity', () => {
    const withDebt = computeDcf({ ...base, netDebt: 5000 });
    const noDebt = computeDcf(base);
    expect(withDebt.equityValue).toBeCloseTo(noDebt.enterpriseValue - 5000, 6);
  });

  it('N INVENTE RIEN : FCF de base ≤ 0 → non calculable', () => {
    const r = computeDcf({ ...base, baseFcf: -10 });
    expect(r.error).toBe('fcf_non_positif');
    expect(r.fairValuePerShare).toBeNull();
  });

  it('N INVENTE RIEN : WACC ≤ croissance terminale → non calculable', () => {
    const r = computeDcf({ ...base, wacc: 0.02, terminalGrowth: 0.02 });
    expect(r.error).toBe('wacc_le_terminal');
    expect(r.fairValuePerShare).toBeNull();
  });

  it('N INVENTE RIEN : actions ≤ 0 → non calculable', () => {
    const r = computeDcf({ ...base, shares: 0 });
    expect(r.error).toBe('shares_invalide');
    expect(r.fairValuePerShare).toBeNull();
  });
});

describe('sensitivityMatrix', () => {
  it('produit une grille WACC × g∞, plus chère quand le WACC baisse', () => {
    const m = sensitivityMatrix(base, [-0.01, 0, 0.01], [-0.005, 0, 0.005]);
    expect(m).toHaveLength(3);
    expect(m[0]).toHaveLength(3);
    // WACC plus bas (ligne 0) → juste-valeur supérieure à WACC plus haut (ligne 2)
    expect(m[0][1]!).toBeGreaterThan(m[2][1]!);
  });

  it('met null là où la combinaison diverge (WACC ≤ g∞)', () => {
    const lowWacc: DcfInputs = { ...base, wacc: 0.025 };
    const m = sensitivityMatrix(lowWacc, [0], [0.01]); // 0.025 ≤ 0.03
    expect(m[0][0]).toBeNull();
  });
});
