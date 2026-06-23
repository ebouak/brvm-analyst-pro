import { describe, it, expect } from 'vitest';
import { parseBlocks, summarizeMarket } from './builder';

describe('parseBlocks', () => {
  it('garde les blocs valides, dans l ordre, dédupliqués', () => {
    expect(parseBlocks('marche,action,marche')).toEqual(['marche', 'action']);
  });
  it('ignore les valeurs inconnues', () => {
    expect(parseBlocks('marche,xxx,secteur')).toEqual(['marche', 'secteur']);
  });
  it('vide / null → []', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks(null)).toEqual([]);
  });
});

describe('summarizeMarket', () => {
  it('compte breadth + top hausse/baisse', () => {
    const s = summarizeMarket([
      { code: 'A', variation_pct: 2 },
      { code: 'B', variation_pct: -1 },
      { code: 'C', variation_pct: 0 },
      { code: 'D', variation_pct: 5 },
    ]);
    expect(s.hausses).toBe(2);
    expect(s.baisses).toBe(1);
    expect(s.breadthPct).toBe(50); // 2 hausses / 4
    expect(s.topHausse).toEqual({ code: 'D', pct: 5 });
    expect(s.topBaisse).toEqual({ code: 'B', pct: -1 });
  });
  it('ignore les variations nulles', () => {
    const s = summarizeMarket([{ code: 'A', variation_pct: null }]);
    expect(s.total).toBe(0);
    expect(s.breadthPct).toBeNull();
  });
});
