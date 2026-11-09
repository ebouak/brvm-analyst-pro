import { describe, it, expect } from 'vitest';
import { aggregateBySector } from './sectors';

const J = '2026-11-09';
const ligne = (code: string, valeur_echangee: number | null, secteur = 'Finance') => ({
  code, secteur, date_marche: J, cours_jour: 1000, variation_pct: 1, valeur_echangee,
});

describe('aggregateBySector — valeur échangée de la séance', () => {
  it('somme les valeurs renseignées', () => {
    const [s] = aggregateBySector([ligne('A', 1500), ligne('B', 500)], J);
    expect(s!.volumeDay).toBe(2000);
  });

  it('ignore une valeur absente quand une autre est renseignée', () => {
    const [s] = aggregateBySector([ligne('A', 1500), ligne('B', null)], J);
    expect(s!.volumeDay).toBe(1500);
  });

  it('rend null, et non 0, quand aucune valeur de la séance ne la renseigne', () => {
    // Séance du 2026-11-09 en cours : 48 lignes, valeur_echangee nulle partout.
    const [s] = aggregateBySector([ligne('A', null), ligne('B', null)], J);
    expect(s!.volumeDay).toBeNull();
  });

  it('garde un vrai zéro publié', () => {
    const [s] = aggregateBySector([ligne('A', 0)], J);
    expect(s!.volumeDay).toBe(0);
  });
});
