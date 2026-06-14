import { describe, it, expect } from 'vitest';
import { covariance, invert, optimize, portfolioStats } from './optimize';

describe('invert', () => {
  it('inverse une matrice 2x2', () => {
    const inv = invert([[4, 7], [2, 6]])!;
    expect(inv[0]![0]).toBeCloseTo(0.6, 5);
    expect(inv[0]![1]).toBeCloseTo(-0.7, 5);
    expect(inv[1]![0]).toBeCloseTo(-0.2, 5);
    expect(inv[1]![1]).toBeCloseTo(0.4, 5);
  });
  it('null si singulière', () => {
    expect(invert([[1, 2], [2, 4]])).toBeNull();
  });
});

describe('covariance', () => {
  it('diagonale = variances', () => {
    const cov = covariance([[1, 2, 3], [2, 4, 6]]);
    expect(cov[0]![0]).toBeCloseTo(1, 5);   // var de [1,2,3] = 1
    expect(cov[0]![1]).toBeCloseTo(2, 5);   // cov parfaite
  });
});

describe('optimize', () => {
  it('deux actifs faiblement corrélés => min-variance calculé et normalisé', () => {
    const a = { code: 'A', returns: [0.03, -0.01, 0.02, 0.04, -0.02, 0.01] };
    const b = { code: 'B', returns: [0.01, 0.02, -0.01, 0.00, 0.03, -0.02] };
    const r = optimize([a, b], [1, 0], 0.06);
    expect(r.minVarianceWeights).not.toBeNull();
    expect(r.minVarianceWeights!.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 5);
    expect(r.riskContributions.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 5);
  });

  it('contributions au risque somment à 1', () => {
    const a = { code: 'A', returns: [0.01, 0.02, -0.01, 0.03, 0.0] };
    const b = { code: 'B', returns: [0.0, 0.01, 0.02, -0.02, 0.01] };
    const r = optimize([a, b], [0.6, 0.4]);
    expect(r.riskContributions.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 5);
  });

  it('portfolioStats : rendement pondéré', () => {
    const s = portfolioStats([0.5, 0.5], [0.10, 0.20], [[0.04, 0], [0, 0.09]], 0.06);
    expect(s.ret).toBeCloseTo(0.15, 5);
    expect(s.vol).toBeGreaterThan(0);
  });
});
