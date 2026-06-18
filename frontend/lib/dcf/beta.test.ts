import { describe, it, expect } from 'vitest';
import { computeBeta, toReturns, MIN_BETA_OBS } from './beta';

describe('toReturns', () => {
  it('calcule les rendements simples période à période', () => {
    const r = toReturns([100, 110, 99]);
    expect(r).toHaveLength(2);
    expect(r[0]).toBeCloseTo(0.1, 10);
    expect(r[1]).toBeCloseTo(-0.1, 10);
  });
  it('ignore les prix précédents invalides (≤ 0 ou non finis)', () => {
    const r = toReturns([0, 100, 110]);
    expect(r).toHaveLength(1);
    expect(r[0]).toBeCloseTo(0.1, 10);
    expect(toReturns([100, NaN, 120])).toEqual([]);
  });
});

describe('computeBeta', () => {
  it('retourne β ≈ 1 et R² ≈ 1 quand le titre suit exactement le marché', () => {
    const market = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.02));
    const r = computeBeta(market, market);
    expect(r.beta).toBeCloseTo(1, 6);
    expect(r.r2).toBeCloseTo(1, 6);
    expect(r.nObs).toBe(20);
  });

  it('retourne β ≈ 2 quand le titre amplifie le marché ×2', () => {
    const market = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.02));
    const stock = market.map((m) => m * 2);
    const r = computeBeta(stock, market);
    expect(r.beta).toBeCloseTo(2, 6);
    expect(r.r2).toBeCloseTo(1, 6);
  });

  it('N INVENTE RIEN : β null si observations insuffisantes', () => {
    const few = [0.01, 0.02, -0.01];
    const r = computeBeta(few, few);
    expect(r.beta).toBeNull();
    expect(r.nObs).toBe(3);
    expect(few.length).toBeLessThan(MIN_BETA_OBS);
  });

  it('N INVENTE RIEN : β null si la variance de marché est nulle', () => {
    const flat = new Array(20).fill(0); // marché plat → pente indéfinie
    const stock = Array.from({ length: 20 }, (_, i) => i * 0.001);
    const r = computeBeta(stock, flat);
    expect(r.beta).toBeNull();
  });
});
