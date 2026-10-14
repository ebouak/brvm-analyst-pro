import { describe, it, expect } from 'vitest';
import { dureeTheorique, PARTICIPATION_VOLUME, SEUIL_ALERTE_SEANCES } from './liquidite';

describe('dureeTheorique', () => {
  it('participation de 20 % par défaut, documentée', () => {
    expect(PARTICIPATION_VOLUME).toBe(0.2);
    expect(SEUIL_ALERTE_SEANCES).toBe(20);
  });

  it('petite position sur une valeur liquide : 1 séance au minimum', () => {
    // 4 498 000 / (325 000 000 × 0,2) = 0,07
    expect(dureeTheorique(4_498_000, 325_000_000)).toEqual({ seances: 1, alerte: false });
  });

  it('arrondi à la séance supérieure, alerte au-delà de 20 séances', () => {
    // 50 M / (8 M × 0,2) = 31,25 → 32
    expect(dureeTheorique(50_000_000, 8_000_000)).toEqual({ seances: 32, alerte: true });
  });

  it('valeur moyenne absente ou nulle : non mesurée, jamais 0', () => {
    expect(dureeTheorique(1_000_000, null)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(1_000_000, 0)).toEqual({ seances: null, alerte: false });
  });

  it('position nulle ou absente : non mesurée', () => {
    expect(dureeTheorique(0, 8_000_000)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(null, 8_000_000)).toEqual({ seances: null, alerte: false });
  });

  // ADDED (hardening)
  it("exactement 20 séances : pas d'alerte ; 21 : alerte", () => {
    // 32 M / (8 M × 0,2) = 20
    expect(dureeTheorique(32_000_000, 8_000_000)).toEqual({ seances: 20, alerte: false });
    // 32,000,001 → 20,0000006 → 21
    expect(dureeTheorique(32_000_001, 8_000_000)).toEqual({ seances: 21, alerte: true });
  });

  // ADDED (hardening)
  it('entrées non finies ou participation invalide : non mesurée', () => {
    expect(dureeTheorique(Number.NaN, 8_000_000)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(1_000_000, Number.POSITIVE_INFINITY)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(Number.POSITIVE_INFINITY, 8_000_000)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(1_000_000, 8_000_000, 0)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(1_000_000, 8_000_000, -0.2)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(1_000_000, 8_000_000, 1.5)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(1_000_000, 8_000_000, Number.NaN)).toEqual({ seances: null, alerte: false });
  });

  it('overflow : ratio non fini devient non mesuré', () => {
    expect(dureeTheorique(1e300, 1e-300)).toEqual({ seances: null, alerte: false });
  });

  it('participation personnalisée valide : 0.5 → 50M / 4M = 12,5 → 13', () => {
    expect(dureeTheorique(50_000_000, 8_000_000, 0.5)).toEqual({ seances: 13, alerte: false });
  });

  it("multiple exact avec participation non défaut : 48M / (8M × 0,3) = 20", () => {
    expect(dureeTheorique(48_000_000, 8_000_000, 0.3)).toEqual({ seances: 20, alerte: false });
  });
});
