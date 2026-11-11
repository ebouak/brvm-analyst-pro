import { describe, it, expect } from 'vitest';
import { resumeBilans, PCT_MIN_MOIS } from './bilan';

let k = 0;
const b = (annee: number, mois: number, verdict: string, tenue: boolean | null, realise: number | null = tenue == null ? null : 0.01) =>
  ({ code: `C${k++}`, annee, mois, verdict, tenue, realise });

describe('resumeBilans', () => {
  it('un mois compte une fois : tenu si la majorité stricte des saisons comptées a tenu', () => {
    const r = resumeBilans([
      b(2026, 11, 'indicatif', true), b(2026, 11, 'etabli', true), b(2026, 11, 'indicatif', false),
      b(2026, 11, 'hasard', null, 0.02),
      b(2026, 12, 'indicatif', true), b(2026, 12, 'indicatif', false),
    ]);
    expect(r.mois).toEqual([
      { annee: 2026, mois: 12, profils: 2, comptees: 2, tenues: 1, statut: 'non_tenu' },
      { annee: 2026, mois: 11, profils: 4, comptees: 3, tenues: 2, statut: 'tenu' },
    ]);
    expect(r).toMatchObject({ moisClos: 2, moisTenus: 1, pourcentage: null });
  });

  it('mois en cours (aucun réalisé) et mois sans saison comptée', () => {
    const r = resumeBilans([b(2027, 1, 'indicatif', null, null), b(2026, 12, 'hasard', null, 0.03)]);
    expect(r.mois.map((m) => m.statut)).toEqual(['en_cours', 'sans_objet']);
    expect(r.moisClos).toBe(0);
  });

  it(`pourcentage affiché seulement à partir de ${PCT_MIN_MOIS} mois clos`, () => {
    const lignes = [1, 2, 3, 4, 5].map((m) => b(2027, m, 'indicatif', m !== 3));
    const r = resumeBilans(lignes);
    expect(r).toMatchObject({ moisClos: 5, moisTenus: 4 });
    expect(r.pourcentage).toBeCloseTo(0.8);
  });
});
