import { describe, it, expect } from 'vitest';
import { FAMILLES, libelleTier, ligneValide } from './facteurs';

describe('FAMILLES', () => {
  it('décrit les cinq familles dans l ordre d affichage', () => {
    expect(FAMILLES.map((f) => f.cle)).toEqual(['tendance', 'risque', 'valorisation', 'qualite', 'rendement']);
    for (const f of FAMILLES) expect(f.haut.length).toBeGreaterThan(5);
  });
});

describe('libelleTier', () => {
  it('traduit les tiers sans verdict', () => {
    expect(libelleTier('haut')).toBe('Tiers haut');
    expect(libelleTier('milieu')).toBe('Tiers médian');
    expect(libelleTier('bas')).toBe('Tiers bas');
    expect(libelleTier(null)).toBe('—');
  });
});

describe('ligneValide', () => {
  it('rejette une ligne sans tiers ni code', () => {
    expect(ligneValide({ code: 'SNTS', date_marche: '2026-11-09', tiers: { tendance: 'haut' }, classe_liquidite: 'A' })).toBe(true);
    expect(ligneValide({ code: '', date_marche: '2026-11-09', tiers: {}, classe_liquidite: null })).toBe(false);
    expect(ligneValide({ code: 'SNTS', date_marche: '2026-11-09', tiers: null, classe_liquidite: null })).toBe(false);
  });
});
