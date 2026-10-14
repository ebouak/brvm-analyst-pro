import { describe, it, expect } from 'vitest';
import { partsAnneau } from './anneau';

describe('partsAnneau', () => {
  it('cas normal : tri décroissant et bornes cumulées', () => {
    const r = partsAnneau([{ code: 'B', valeur: 25 }, { code: 'A', valeur: 75 }]);
    expect(r.map((p) => p.code)).toEqual(['A', 'B']);
    expect(r[0]).toMatchObject({ part: 0.75, debut: 0, fin: 0.75 });
    expect(r[1].debut).toBeCloseTo(0.75, 12);
    expect(r[1].fin).toBe(1);
  });
  it('regroupe en « Autres » au-delà de maxParts', () => {
    const l = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((code, i) => ({ code, valeur: 70 - i * 10 }));
    const r = partsAnneau(l, 5);
    expect(r).toHaveLength(5);
    expect(r.map((p) => p.code)).toEqual(['A', 'B', 'C', 'D', 'Autres']);
    expect(r[4].part).toBeCloseTo((30 + 20 + 10) / 280, 12);
  });
  it('tout à zéro, négatif ou non fini : vide', () => {
    expect(partsAnneau([{ code: 'A', valeur: 0 }, { code: 'B', valeur: -3 }, { code: 'C', valeur: Number.NaN }])).toEqual([]);
    expect(partsAnneau([])).toEqual([]);
  });
  it('la somme vaut 1 à 1e-9 près', () => {
    const l = Array.from({ length: 11 }, (_, i) => ({ code: `V${i}`, valeur: (i + 1) * 1234.567 }));
    for (const max of [3, 5, 20]) {
      const r = partsAnneau(l, max);
      expect(Math.abs(r.reduce((s, p) => s + p.part, 0) - 1)).toBeLessThan(1e-9);
      expect(r[r.length - 1].fin).toBe(1);
    }
  });
  it('plusieurs lots de la même valeur : une seule part', () => {
    const r = partsAnneau([{ code: 'SNTS', valeur: 100 }, { code: 'SNTS', valeur: 50 }, { code: 'ORAC', valeur: 50 }]);
    expect(r.map((x) => x.code)).toEqual(['SNTS', 'ORAC']);
    expect(r[0]!.part).toBeCloseTo(0.75, 9);
  });
});
