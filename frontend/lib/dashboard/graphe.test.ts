import { describe, it, expect } from 'vitest';
import { echelle, cheminSparkline, indexMinInterieur, barresDivergentes } from './graphe';

describe('echelle', () => {
  it('marge de 15 % et 5 graduations régulières', () => {
    const e = echelle([100, 200])!;
    expect(e.bas).toBeCloseTo(85, 9);
    expect(e.haut).toBeCloseTo(215, 9);
    expect(e.graduations).toHaveLength(5);
    expect(e.graduations[0]).toBeCloseTo(85, 9);
    expect(e.graduations[4]).toBeCloseTo(215, 9);
  });
  it('série plate : marge de 1', () => {
    expect(echelle([50, 50])).toMatchObject({ bas: 49, haut: 51 });
  });
  it('valeurs non finies ignorées ; vide → null', () => {
    expect(echelle([Number.NaN])).toBeNull();
  });
});

describe('cheminSparkline', () => {
  it('points dans le cadre, premier à gauche, dernier à droite', () => {
    const p = cheminSparkline([1, 3, 2], 84, 24)!;
    expect(p.points.split(' ')).toHaveLength(3);
    expect(p.points.startsWith('3.0,')).toBe(true);
    expect(p.dernier[0]).toBeCloseTo(81, 6);
    expect(p.hausse).toBe(true);
  });
  it('série constante : ligne centrée verticalement', () => {
    const p = cheminSparkline([5, 5, 5], 84, 24)!;
    expect(p.points.split(' ').every((q) => q.endsWith(',12.0'))).toBe(true);
  });
  it('moins de deux points finis : null', () => {
    expect(cheminSparkline([5], 84, 24)).toBeNull();
    expect(cheminSparkline([5, Number.NaN], 84, 24)).toBeNull();
  });
});

describe('indexMinInterieur', () => {
  it('minimum strictement intérieur, sinon null', () => {
    expect(indexMinInterieur([3, 1, 2])).toBe(1);
    expect(indexMinInterieur([1, 2, 3])).toBeNull();
    expect(indexMinInterieur([3, 2, 1])).toBeNull();
  });
});

describe('barresDivergentes', () => {
  it('largeur relative au plus grand écart, plancher 0,5 point', () => {
    const b = barresDivergentes([{ cle: 'A', v: 2 }, { cle: 'B', v: -1 }, { cle: 'C', v: 0 }]);
    expect(b).toEqual([
      { cle: 'A', v: 2, largeur: 50, sens: 'up' },
      { cle: 'B', v: -1, largeur: 25, sens: 'down' },
      { cle: 'C', v: 0, largeur: 0, sens: 'flat' },
    ]);
    expect(barresDivergentes([{ cle: 'X', v: 0.1 }])[0]!.largeur).toBeCloseTo(10, 9);
  });
});
