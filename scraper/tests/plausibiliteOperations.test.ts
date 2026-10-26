import { describe, expect, it } from 'vitest';
import { variationsAberrantes } from '../src/cloture/plausibilite.js';
import { ramenerEchelle } from '../src/dividends/operations.js';

describe('variationsAberrantes', () => {
  it('signale le −89,28 % du fractionnement SNTS', () => {
    expect(
      variationsAberrantes([
        { code: 'SNTS', variation_pct: -89.28 },
        { code: 'ORAC', variation_pct: 7.5 },
        { code: 'BOAB', variation_pct: -7.49 },
        { code: 'SGBC', variation_pct: null },
      ]),
    ).toEqual(['SNTS -89.28 %']);
  });

  it('laisse passer une séance ordinaire', () => {
    expect(variationsAberrantes([{ code: 'SNTS', variation_pct: 7.18 }])).toEqual([]);
  });

  it('attrape aussi un regroupement (hausse x10)', () => {
    expect(variationsAberrantes([{ code: 'XXXX', variation_pct: 900 }])).toHaveLength(1);
  });
});

describe('ramenerEchelle', () => {
  const ops = [{ code: 'SNTS', ratio: 10 }];
  const existants = new Map([
    ['SNTS|2025', 174],
    ['SNTS|2024', 166],
  ]);

  it('ramène 1 740 F relu au calendrier BRVM vers 174 F', () => {
    const { rows, ramenees } = ramenerEchelle(
      [{ code: 'SNTS', exercice: 2025, montant: 1740, montant_brut: 1933.33 }],
      ops,
      existants,
    );
    expect(rows[0].montant).toBe(174);
    expect(rows[0].montant_brut).toBeCloseTo(193.333, 3);
    expect(ramenees).toEqual(['SNTS|2025']);
  });

  it('laisse une valeur déjà à la bonne échelle', () => {
    const { rows, ramenees } = ramenerEchelle([{ code: 'SNTS', exercice: 2024, montant: 166 }], ops, existants);
    expect(rows[0].montant).toBe(166);
    expect(ramenees).toEqual([]);
  });

  it('laisse passer une révision légitime (ni ≈ 1×, ni ≈ 10×)', () => {
    const { rows } = ramenerEchelle([{ code: 'SNTS', exercice: 2024, montant: 170 }], ops, existants);
    expect(rows[0].montant).toBe(170);
  });

  it('ne devine rien sans valeur en base', () => {
    const { rows } = ramenerEchelle([{ code: 'SNTS', exercice: 2019, montant: 1350 }], ops, existants);
    expect(rows[0].montant).toBe(1350);
  });

  it('ne touche pas une autre valeur', () => {
    const { rows } = ramenerEchelle(
      [{ code: 'ORAC', exercice: 2025, montant: 1740 }],
      ops,
      new Map([['ORAC|2025', 174]]),
    );
    expect(rows[0].montant).toBe(1740);
  });
});
