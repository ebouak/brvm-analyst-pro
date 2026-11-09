import { describe, it, expect } from 'vitest';
import { derniereIntermediaire, type LigneIntermediaire } from './intermediaires';

const l = (periode: string, type: string, ca: number | null, rn: number | null): LigneIntermediaire =>
  ({ code: 'X', periode, type_periode: type, revenu_total: ca, resultat_net: rn });

describe('derniereIntermediaire', () => {
  it('prend la plus récente et la même période un an avant', () => {
    const r = derniereIntermediaire([l('2025-T3', 'trimestre', 100, 10), l('2026-T3', 'trimestre', 130, 5), l('2026-T2', 'trimestre', 1, 1)]);
    expect(r).toMatchObject({ libelle: 'T3 2026', comparable: true, variationCaPct: 30, variationResultatPct: -50 });
  });
  it('un semestre S1 2026 l emporte sur un T1 2026', () => {
    expect(derniereIntermediaire([l('2026-T1', 'trimestre', 1, 1), l('2026-S1', 'semestriel', 2, 2)])?.libelle).toBe('S1 2026');
  });
  it('période N-1 absente : non comparable', () => {
    expect(derniereIntermediaire([l('2026-T3', 'trimestre', 130, 5)])).toMatchObject({ comparable: false, variationCaPct: null, variationResultatPct: null });
  });
  it('base nulle ou négative : variation null', () => {
    expect(derniereIntermediaire([l('2025-S1', 'semestriel', 0, -5), l('2026-S1', 'semestriel', 9, 3)])).toMatchObject({ comparable: true, variationCaPct: null, variationResultatPct: null });
  });
  it('ne mélange pas trimestre et semestre', () => {
    expect(derniereIntermediaire([l('2025-S1', 'semestriel', 1, 1), l('2026-T1', 'trimestre', 2, 2)])?.comparable).toBe(false);
  });
  it('aucune ligne exploitable : null', () => {
    expect(derniereIntermediaire([])).toBeNull();
    expect(derniereIntermediaire([l('bidon', 'trimestre', 1, 1)])).toBeNull();
  });
});
