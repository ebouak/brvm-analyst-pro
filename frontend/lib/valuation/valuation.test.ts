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
  it('multiples pairs ; la valeur de rendement reste hors moyenne', () => {
    const fv = computeFairValue({
      eps: 12, bvps: 60, price: 5000,
      peers: { medianPER: 500, medianPBR: 100 },
      dividendPerShare: 250, dividendGrowth: 0.02,
    });
    expect(fv.byPER).toBeCloseTo(6000, 5);  // 12 × 500
    expect(fv.byPBR).toBeCloseTo(6000, 5);  // 60 × 100
    expect(fv.byDDM).not.toBeNull();
    expect(fv.methods).not.toContain('DDM (Gordon-Shapiro)');
    expect(fv.fairValue).toBeCloseTo(6000, 5); // (6000 + 6000) / 2, DDM exclue
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
    expect(v.cautions.some((c) => /qualité fondamentale fragile/i.test(c))).toBe(true);
  });

  it('données non fiables => verdict indisponible', () => {
    const m = computeMetrics({ current: { year: null, revenue: 1e9, net_income: 13, equity: 1e8, cash: 0, debt: 0 }, price: 5000, shares: 1e7, dividendPerShare: null });
    const fv = computeFairValue({ eps: null, bvps: null, price: 5000, peers: { medianPER: null, medianPBR: null }, dividendPerShare: null });
    const v = buildVerdict(m, fv, computeQuality(m));
    expect(v.stance).toBe('indisponible');
  });
});

describe('corrections du 2026-11-13', () => {
  const pairs = { medianPER: 10, medianPBR: 1 };
  it('B1 — la valeur de rendement n’entre pas dans la valeur estimée', () => {
    const avec = computeFairValue({ eps: 100, bvps: 1000, price: 1000, peers: pairs, dividendPerShare: 40 });
    const sans = computeFairValue({ eps: 100, bvps: 1000, price: 1000, peers: pairs, dividendPerShare: null });
    expect(avec.fairValue).toBe(sans.fairValue);
    expect(avec.byDDM).toBeCloseTo(400, 6); // 40 ÷ 10 %, affichée à part
  });
  it('B3 — résultat insuffisant (ROE ≤ 2 %) : non estimable, aucun écart', () => {
    const fv = computeFairValue({ eps: 1, bvps: 1000, price: 1000, peers: pairs, dividendPerShare: null, roe: 0.001, per: 519 });
    expect(fv.exclusion).toBe('resultat_insuffisant');
    expect(fv.upside).toBeNull();
  });
  it('B3 — P/E inférieur à 3 : méthode P/E écartée', () => {
    const fv = computeFairValue({ eps: 800, bvps: 1000, price: 1000, peers: pairs, dividendPerShare: null, roe: 0.3, per: 1.3 });
    expect(fv.perEcarte).toBe(true);
    expect(fv.byPER).toBeNull();
    expect(fv.methods).toEqual(['Multiples P/B pairs']);
  });
  it('B4 — méthodes de part et d’autre du cours : désaccord et fourchette', () => {
    // P/E → 100 × 10 = 1 000 ; P/B → 3 000 × 1 = 3 000 ; cours 2 000.
    const fv = computeFairValue({ eps: 100, bvps: 3000, price: 2000, peers: pairs, dividendPerShare: null, roe: 0.1, per: 20 });
    expect(fv.accord).toBe('desaccord');
    expect([fv.basse, fv.haute]).toEqual([1000, 3000]);
  });
  it('B4 — verdict « méthodes en désaccord », écart plafonné à ±60 % sinon', async () => {
    const { buildVerdict, ecartAffiche } = await import('./verdict');
    const m = computeMetrics({ current: good, previous: prev, price: 2000, shares: 10_000_000, dividendPerShare: null });
    const fv = computeFairValue({ eps: 100, bvps: 3000, price: 2000, peers: pairs, dividendPerShare: null, roe: 0.1, per: 20 });
    expect(buildVerdict(m, fv, computeQuality(m)).stance).toBe('desaccord');
    expect(ecartAffiche(6.23)).toBe('plus de +60 %');
    expect(ecartAffiche(-0.19)).toBe('−19 %');
  });
  it('B3 — comptes trop anciens : non estimable', async () => {
    const { buildVerdict } = await import('./verdict');
    const m = computeMetrics({ current: good, previous: prev, price: 3000, shares: 10_000_000, dividendPerShare: null });
    const fv = computeFairValue({ eps: m.eps, bvps: m.bvps, price: 3000, peers: { medianPER: 500, medianPBR: 100 }, dividendPerShare: null });
    const v = buildVerdict(m, fv, computeQuality(m), { annee: 2021, tropAncien: true });
    expect(v.stance).toBe('non_estimable');
    expect(v.headline).toMatch(/trop anciens/);
  });
  it('B6 — ratios au format français', async () => {
    const { buildVerdict } = await import('./verdict');
    const m = computeMetrics({ current: good, previous: prev, price: 3000, shares: 10_000_000, dividendPerShare: null });
    const fv = computeFairValue({ eps: m.eps, bvps: m.bvps, price: 3000, peers: { medianPER: 500, medianPBR: 100 }, dividendPerShare: null });
    const texte = buildVerdict(m, fv, computeQuality(m)).rationale.join(' ');
    expect(texte).not.toMatch(/P\/[EB] \d+\.\d/);
  });
});
