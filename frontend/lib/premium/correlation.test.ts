import { describe, it, expect } from 'vitest';
import { returns, pearson, beta, rollingCorr } from './correlationMath';
import { readCommodityMacro } from './agroMacro';

describe('correlationMath', () => {
  it('returns : variations période à période', () => {
    expect(returns([100, 110, 99])).toEqual([0.1, expect.closeTo(-0.1, 5)]);
  });

  it('pearson : +1 pour séries parfaitement alignées', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearson(x, y)).toBeCloseTo(1, 5);
  });

  it('pearson : -1 pour séries opposées', () => {
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 5);
  });

  it('pearson : null si trop court', () => {
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });

  it('beta : pente de régression', () => {
    // y = 2x => beta 2
    expect(beta([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(2, 5);
  });

  it('rollingCorr : fenêtre remplie après w points', () => {
    const x = [0.1, -0.1, 0.2, -0.2, 0.1, 0.3];
    const y = [0.1, -0.1, 0.2, -0.2, 0.1, 0.3];
    const r = rollingCorr(x, y, 3);
    expect(r[0]).toBeNull();
    expect(r[1]).toBeNull();
    expect(r[2]).toBeCloseTo(1, 5);
  });
});

describe('readCommodityMacro', () => {
  it('tendance hausse + corrélation forte => impact favorable aligné', () => {
    // 13 points croissants
    const prices = Array.from({ length: 13 }, (_, i) => 100 + i * 5);
    const m = readCommodityMacro(prices, 'Cacao', 0.7);
    expect(m.trend).toBe('hausse');
    expect(m.change12m).toBeGreaterThan(0);
    expect(m.reading).toMatch(/favorablement/i);
  });

  it('tendance baisse => pression sur les marges', () => {
    const prices = Array.from({ length: 13 }, (_, i) => 200 - i * 5);
    const m = readCommodityMacro(prices, 'Sucre', 0.5);
    expect(m.trend).toBe('baisse');
    expect(m.reading).toMatch(/pression/i);
  });

  it('historique court => changements null, tendance stable', () => {
    const m = readCommodityMacro([100, 101], 'Caoutchouc', null);
    expect(m.change12m).toBeNull();
    expect(m.trend).toBe('stable');
  });
});
