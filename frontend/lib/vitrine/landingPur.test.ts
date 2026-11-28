import { describe, expect, it } from 'vitest';
import { parcoursDepuis, pointsCourbe } from './landingPur';

describe('pointsCourbe', () => {
  it('axe vertical fixe 0-100 : la hauteur dit la tension', () => {
    expect(pointsCourbe([0, 100], 100, 50)).toBe('0.0,50.0 100.0,0.0');
    expect(pointsCourbe([50, 50, 50], 100, 40)).toBe('0.0,20.0 50.0,20.0 100.0,20.0');
  });
  it('moins de deux points ou valeurs non finies : courbe vide ou filtrée', () => {
    expect(pointsCourbe([42], 100, 50)).toBe('');
    expect(pointsCourbe([Number.NaN, 0, 100], 100, 50)).toBe('0.0,50.0 100.0,0.0');
  });
});

describe('parcoursDepuis', () => {
  const lignes = [
    { niveau: 'expert', content: { lessons: [1, 2, 3, 4, 5] } },
    { niveau: 'debutant', content: { lessons: new Array(11).fill(0) } },
    { niveau: 'avance', content: { lessons: new Array(8).fill(0) } },
    { niveau: 'intermediaire', content: { lessons: new Array(18).fill(0) } },
  ];
  it('quatre niveaux, dans l’ordre du parcours', () => {
    expect(parcoursDepuis(lignes)).toEqual([
      { niveau: 'debutant', lecons: 11 },
      { niveau: 'intermediaire', lecons: 18 },
      { niveau: 'avance', lecons: 8 },
      { niveau: 'expert', lecons: 5 },
    ]);
  });
  it('un niveau manquant ou vide : rien (jamais un parcours partiel)', () => {
    expect(parcoursDepuis(lignes.slice(1))).toBeNull();
    expect(parcoursDepuis([...lignes.slice(1), { niveau: 'expert', content: { lessons: [] } }])).toBeNull();
    expect(parcoursDepuis([...lignes, { niveau: 'inconnu', content: null }])).toHaveLength(4);
  });
});
