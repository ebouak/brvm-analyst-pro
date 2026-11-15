import { describe, expect, it } from 'vitest';
import { lireNombre, facteur, granularite } from '../src/agregats/nombres.js';

describe('lireNombre', () => {
  it.each([
    ['152 345', 152345, 0],
    ['152 345,6', 152345.6, 1],
    ['152 345', 152345, 0],
    ['1.234.567', 1234567, 0],
    ['12.5', 12.5, 1],
    ['(1 234)', -1234, 0],
    ['−3 210,25', -3210.25, 2],
    ['16,19 %', 16.19, 2],
  ])('« %s »', (t, v, d) => {
    expect(lireNombre(t)).toEqual({ valeur: v, decimales: d });
  });
  it.each(['n.d.', '', '12,3,4', 'abc'])('illisible « %s »', (t) => {
    expect(lireNombre(t)).toBeNull();
  });
});

describe('granularité', () => {
  it('unité imprimée × dernière décimale', () => {
    expect(facteur('millions')).toBe(1e6);
    expect(granularite({ unite_source: 'millions', decimales: 1 })).toBeCloseTo(1e5);
    expect(granularite({ unite_source: 'unites', decimales: 0 })).toBe(1);
    expect(granularite({ unite_source: null, decimales: null })).toBe(1);
  });
});
