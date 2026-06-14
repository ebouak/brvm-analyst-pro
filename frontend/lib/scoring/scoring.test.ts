import { describe, it, expect } from 'vitest';
import { computeFScore, type FScoreYear } from './piotroski';
import { computeAltmanZ } from './altman';

// PALC-like (société saine, données réelles 2025/2024)
const curr: FScoreYear = {
  revenu_total: 197_629_996_000, marge_brute: 87_017_558_000, resultat_net: 15_508_655_000,
  actions_en_circulation: 20_406_297, total_actifs: 199_116_293_000,
  total_actif_circulant: 86_256_798_000, passif_courant: 55_680_750_000,
  dette_long_terme: 796_559_000, flux_exploitation: 38_740_600_000,
};
const prev: FScoreYear = {
  revenu_total: 172_182_502_000, marge_brute: 80_772_882_000, resultat_net: 15_861_643_000,
  actions_en_circulation: 20_406_297, total_actifs: 190_000_000_000,
  total_actif_circulant: 80_000_000_000, passif_courant: 56_000_000_000,
  dette_long_terme: 1_200_000_000, flux_exploitation: 35_000_000_000,
};

describe('computeFScore', () => {
  it('société saine => score élevé, CFO>résultat net validé', () => {
    const r = computeFScore(curr, prev);
    expect(r.reliable).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(6);
    expect(r.criteria.find((c) => /CFO/.test(c.label))!.pass).toBe(true);
    expect(r.criteria.find((c) => /dilution/i.test(c.label))!.pass).toBe(true);
  });

  it('données insuffisantes => non fiable', () => {
    const bad = { ...curr, total_actifs: null };
    expect(computeFScore(bad, prev).reliable).toBe(false);
  });

  it('détecte la dilution', () => {
    const diluted = { ...curr, actions_en_circulation: 30_000_000 };
    const r = computeFScore(diluted, prev);
    expect(r.criteria.find((c) => /dilution/i.test(c.label))!.pass).toBe(false);
  });
});

describe('computeAltmanZ', () => {
  it('société générale saine => zone safe', () => {
    const r = computeAltmanZ({
      total_actifs: 199_116_293_000, total_actif_circulant: 86_256_798_000, passif_courant: 55_680_750_000,
      reserves_benefices_non_repartis: 106_724_033_000, resultat_exploitation: 18_163_004_000,
      total_capitaux_propres: 142_638_984_000, famille: 'general',
    });
    expect(r.applicable).toBe(true);
    expect(r.z).toBeGreaterThan(2.6);
    expect(r.zone).toBe('safe');
  });

  it('banque => non applicable', () => {
    const r = computeAltmanZ({
      total_actifs: 1e12, total_actif_circulant: null, passif_courant: null,
      reserves_benefices_non_repartis: 1e10, resultat_exploitation: 5e9,
      total_capitaux_propres: 8e10, famille: 'banque',
    });
    expect(r.applicable).toBe(false);
    expect(r.note).toMatch(/banque/i);
  });

  it('détresse => zone distress', () => {
    const r = computeAltmanZ({
      total_actifs: 1000, total_actif_circulant: 100, passif_courant: 800,
      reserves_benefices_non_repartis: -500, resultat_exploitation: -200,
      total_capitaux_propres: 50, famille: 'general',
    });
    expect(r.zone).toBe('distress');
  });
});
