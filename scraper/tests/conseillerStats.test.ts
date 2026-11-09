import { describe, it, expect } from 'vitest';
import { prng, rangTransversal, bootstrapStationnaire, quantile, testSigne, effetMinimalDetectable, ecartType } from '../src/conseiller/stats.js';

describe('prng', () => {
  it('est reproductible', () => {
    const a = prng(1), b = prng(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('rangTransversal', () => {
  it('met le plus haut à +1 et le plus bas à −1 (sens +1)', () => {
    const r = rangTransversal(new Map([['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5]]), 1);
    expect(r.get('E')).toBeCloseTo(1);
    expect(r.get('A')).toBeCloseTo(-1);
    expect(r.get('C')).toBeCloseTo(0);
  });
  it('inverse avec le sens −1', () => {
    const r = rangTransversal(new Map([['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5]]), -1);
    expect(r.get('A')).toBeCloseTo(1);
  });
  it('rend tout null sous 5 valeurs non nulles', () => {
    const r = rangTransversal(new Map<string, number | null>([['A', 1], ['B', null], ['C', 3], ['D', 4]]), 1);
    expect([...r.values()].every((v) => v === null)).toBe(true);
  });
  it('donne le même rang aux ex æquo', () => {
    const r = rangTransversal(new Map([['A', 1], ['B', 2], ['C', 2], ['D', 4], ['E', 5]]), 1);
    expect(r.get('B')).toBeCloseTo(r.get('C')!);
  });
});

describe('bootstrapStationnaire', () => {
  it('est centré sur la moyenne et reproductible', () => {
    const xs = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 1 : 3));
    const m1 = bootstrapStationnaire(xs, { blocMoyen: 3, tirages: 2000, graine: 7 });
    const m2 = bootstrapStationnaire(xs, { blocMoyen: 3, tirages: 2000, graine: 7 });
    expect(m1).toEqual(m2);
    expect(quantile(m1, 0.5)).toBeCloseTo(2, 0);
  });
});

describe('testSigne', () => {
  it('compte les positifs et donne une p-valeur unilatérale', () => {
    const r = testSigne([1, 2, 3, -1, 4, 5, 6, 7, 8, 9]);
    expect(r.positifs).toBe(9);
    expect(r.n).toBe(10);
    expect(r.p).toBeCloseTo(11 / 1024, 4);
  });
});

describe('effetMinimalDetectable', () => {
  it('suit (z0,95 + z0,80) × σ / √n, puis × 252/20 pour l annualiser', () => {
    const r = effetMinimalDetectable(7, 60);
    expect(r.parPeriode).toBeCloseTo((1.6449 + 0.8416) * 7 / Math.sqrt(60), 2);
    expect(r.annualise).toBeCloseTo(r.parPeriode * 12.6, 2);
  });
});

describe('ecartType', () => {
  it('calcule l écart-type d échantillon', () => {
    expect(ecartType([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });
});
