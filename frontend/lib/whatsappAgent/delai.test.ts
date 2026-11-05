import { describe, expect, it } from 'vitest';
import { DELAI_APPEL_MAX_MS, DELAI_APPEL_MS, delaiAppel } from './delai';

describe('delaiAppel', () => {
  it('sans échéance : 30 s, comme avant', () => {
    expect(delaiAppel(1_000)).toBe(DELAI_APPEL_MS);
  });

  it('avec échéance : le temps restant (une rédaction de 24 s n’est plus coupée à 30 s)', () => {
    expect(delaiAppel(0, 45_000)).toBe(45_000);
  });

  it('plafonné à 60 s : un fournisseur muet laisse du temps au suivant', () => {
    expect(delaiAppel(0, 80_000)).toBe(DELAI_APPEL_MAX_MS);
  });

  it('trop peu de temps restant : aucun appel', () => {
    expect(delaiAppel(10_000, 12_000)).toBeNull();
    expect(delaiAppel(10_000, 5_000)).toBeNull();
  });
});
