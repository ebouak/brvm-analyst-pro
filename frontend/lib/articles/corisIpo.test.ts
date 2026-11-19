import { describe, expect, it } from 'vitest';
import { calculerWpli, CORIS_IPOS, CORIS_RATIOS, DIVIDENDE_WINDOW, MARCHE } from './corisIpo';

describe('article IPO Coris', () => {
  it('réconcilie les deux montants annoncés', () => {
    expect(CORIS_IPOS.reduce((sum, item) => sum + item.montantMd, 0)).toBe(MARCHE.totalIpoMd);
    expect(CORIS_IPOS[0].partAnnoncedPct).toBeCloseTo(76.54, 2);
    expect(CORIS_IPOS[1].partAnnoncedPct).toBeCloseTo(23.46, 2);
  });

  it('calcule l’échelle de marché sans diviser par zéro', () => {
    expect(CORIS_RATIOS.foisSeance).toBeCloseTo(7.313, 2);
    expect(CORIS_RATIOS.capitalisationPct).toBeCloseTo(0.421, 2);
    expect(CORIS_RATIOS.volumeAnnuelPct).toBeCloseTo(29.519, 2);
    expect(81 / 11.075).toBeCloseTo(7.313, 2);
    expect(81 / 19235.5 * 100).toBeCloseTo(0.4211, 3);
  });

  it('préserve les trois phases de fenêtre dividende', () => {
    expect(DIVIDENDE_WINDOW.map((item) => item.phase)).toEqual([
      '5 séances avant',
      'Ex-date',
      '5 séances après',
    ]);
  });

  it('calcule le WPLI comme une pression simulée', () => {
    expect(calculerWpli({ souscriptionsMd: 81, partVentes: 0.25, valeur20jMd: 2 })).toEqual({
      statut: 'calculable',
      cashVenteMd: 20.25,
      seancesEquivalentes: 10.125,
    });
    expect(calculerWpli({ souscriptionsMd: 81, partVentes: 0, valeur20jMd: 2 })).toEqual({
      statut: 'calculable',
      cashVenteMd: 0,
      seancesEquivalentes: 0,
    });
  });

  it('refuse une base de liquidité absente sans masquer le cas', () => {
    expect(calculerWpli({ souscriptionsMd: 81, partVentes: 0.25, valeur20jMd: 0 })).toEqual({
      statut: 'indisponible',
    });
  });
});
