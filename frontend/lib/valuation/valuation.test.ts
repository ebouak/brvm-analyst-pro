import { describe, it, expect } from 'vitest';
import { computeMetrics, isReliable, type Fundamentals } from './metrics';
import { computeFairValue, median } from './fairValue';
import { computeQuality } from './quality';
import { buildVerdict } from './verdict';

const good: Fundamentals = { year: 2024, revenue: 1_000_000_000, net_income: 120_000_000, equity: 600_000_000, cash: 50_000_000, debt: 300_000_000 };
const prev: Fundamentals = { year: 2023, revenue: 900_000_000, net_income: 100_000_000, equity: 550_000_000, cash: 40_000_000, debt: 320_000_000 };

describe('isReliable', () => {
  it('rejette les magnitudes aberrantes (net_income > revenue, year null)', () => {
    expect(isReliable({ year: null, revenue: 1e9, net_income: 13, equity: 1e8, cash: 0, debt: 0 })).toBe(false);
    expect(isReliable({ year: 2024, revenue: 1000, net_income: 13, equity: 1e8, cash: 0, debt: 0 })).toBe(false); // CA dérisoire
    expect(isReliable({ year: 2024, revenue: 1e9, net_income: 2e9, equity: 1e8, cash: 0, debt: 0 })).toBe(false); // NI > CA
    expect(isReliable(good)).toBe(true);
  });
});

describe('computeMetrics', () => {
  it('calcule ratios par action avec shares + croissance', () => {
    const m = computeMetrics({ current: good, previous: prev, price: 5000, shares: 10_000_000, dividendPerShare: 250 });
    expect(m.reliable).toBe(true);
    expect(m.eps).toBeCloseTo(12, 5);          // 120M / 10M
    expect(m.bvps).toBeCloseTo(60, 5);         // 600M / 10M
    expect(m.per).toBeCloseTo(5000 / 12, 3);
    expect(m.pbr).toBeCloseTo(5000 / 60, 3);
    expect(m.roe).toBeCloseTo(0.2, 5);         // 120/600
    expect(m.netMargin).toBeCloseTo(0.12, 5);
    expect(m.revenueGrowth).toBeCloseTo(0.1111, 3);
    expect(m.dividendYield).toBeCloseTo(0.05, 5); // 250/5000
  });

  it('sans shares : ratios par action null, ROE/marge présents', () => {
    const m = computeMetrics({ current: good, previous: null, price: 5000, shares: null, dividendPerShare: null });
    expect(m.per).toBeNull();
    expect(m.eps).toBeNull();
    expect(m.roe).toBeCloseTo(0.2, 5);
  });

  it('données non fiables => tout null', () => {
    const m = computeMetrics({ current: { year: null, revenue: 1e9, net_income: 13, equity: 1e8, cash: 0, debt: 0 }, price: 5000, shares: 1e7, dividendPerShare: null });
    expect(m.reliable).toBe(false);
    expect(m.roe).toBeNull();
  });
});

describe('computeFairValue', () => {
  it('multiples pairs + DDM, upside vs cours', () => {
    const fv = computeFairValue({
      eps: 12, bvps: 60, price: 5000,
      peers: { medianPER: 500, medianPBR: 100 },
      dividendPerShare: 250, dividendGrowth: 0.02,
    });
    expect(fv.byPER).toBeCloseTo(6000, 5);  // 12 × 500
    expect(fv.byPBR).toBeCloseTo(6000, 5);  // 60 × 100
    expect(fv.byDDM).not.toBeNull();
    expect(fv.methods).toContain('DDM (Gordon-Shapiro)');
    expect(fv.fairValue).toBeGreaterThan(0);
    expect(fv.upside).toBeGreaterThan(0); // juste-valeur > cours
  });

  it('DDM garantit r > g (croissance plafonnée)', () => {
    const fv = computeFairValue({ eps: null, bvps: null, price: 1000, peers: { medianPER: null, medianPBR: null }, dividendPerShare: 50, dividendGrowth: 0.5 });
    expect(fv.ddmAssumptions!.g).toBeLessThan(fv.ddmAssumptions!.r);
  });

  it('median ignore null et non-positifs', () => {
    expect(median([10, null, 20, 0, 30])).toBe(20);
  });
});

describe('computeQuality + buildVerdict', () => {
  it('société rentable peu endettée => qualité solide', () => {
    const m = computeMetrics({ current: good, previous: prev, price: 5000, shares: 10_000_000, dividendPerShare: 250 });
    const q = computeQuality(m);
    expect(q.label).toBe('Solide');
    expect(q.score).toBeGreaterThanOrEqual(4);
  });

  it('verdict décote + qualité fragile => avertit value trap', () => {
    const m = computeMetrics({ current: good, previous: prev, price: 3000, shares: 10_000_000, dividendPerShare: 250 });
    const fv = computeFairValue({ eps: m.eps, bvps: m.bvps, price: 3000, peers: { medianPER: 500, medianPBR: 100 }, dividendPerShare: 250, dividendGrowth: 0 });
    // Force qualité fragile artificiellement
    const fragile = { ...computeQuality(m), label: 'Fragile' as const };
    const v = buildVerdict(m, fv, fragile);
    expect(v.stance).toBe('decote');
    expect(v.cautions.some((c) => /value trap/i.test(c))).toBe(true);
  });

  it('données non fiables => verdict indisponible', () => {
    const m = computeMetrics({ current: { year: null, revenue: 1e9, net_income: 13, equity: 1e8, cash: 0, debt: 0 }, price: 5000, shares: 1e7, dividendPerShare: null });
    const fv = computeFairValue({ eps: null, bvps: null, price: 5000, peers: { medianPER: null, medianPBR: null }, dividendPerShare: null });
    const v = buildVerdict(m, fv, computeQuality(m));
    expect(v.stance).toBe('indisponible');
  });
});
