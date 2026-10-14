import { describe, it, expect } from 'vitest';
import { titreSeance, chapoSeance } from './recit';
import { fmtNumber, fmtFcfa } from '@/lib/format';

describe('titreSeance', () => {
  it('repli, hausse, équilibre ; accords', () => {
    expect(titreSeance(15, 22)).toBe('Séance en repli : 22 baisses pour 15 hausses');
    expect(titreSeance(22, 1)).toBe('Séance en hausse : 22 hausses pour 1 baisse');
    expect(titreSeance(10, 10)).toBe('Séance équilibrée : 10 hausses, 10 baisses');
  });
  it('données absentes ou aucune valeur en mouvement : null', () => {
    expect(titreSeance(null, 3)).toBeNull();
    expect(titreSeance(0, 0)).toBeNull();
  });
});

describe('chapoSeance', () => {
  it('trois phrases quand tout est connu', () => {
    const c = chapoSeance({
      composite: { valeur: 545.46, variationPct: -0.26 },
      meneur: { code: 'BRVMINDU', variationPct: 1.95 },
      valeurEchangee: 2_919_495_128,
      valeurEchangeeVeille: 2_956_520_400,
    });
    const d = (2_919_495_128 / 2_956_520_400 - 1) * 100;
    expect(c).toBe(
      `Le BRVM Composite cède ${fmtNumber(0.26, 2)} % à ${fmtNumber(545.46, 2)} points. ` +
      `Les industriels mènent les secteurs (+${fmtNumber(1.95, 2)} %). ` +
      `${fmtFcfa(2_919_495_128)} FCFA échangés, −${fmtNumber(Math.abs(d), 1)} % sur la veille.`,
    );
  });
  it('phrase omise si la donnée manque ; secteur en baisse : « résiste le mieux »', () => {
    const c = chapoSeance({ composite: null, meneur: { code: 'BRVMENER', variationPct: -0.1 }, valeurEchangee: null, valeurEchangeeVeille: null });
    expect(c).toBe(`L'énergie résiste le mieux (−${fmtNumber(0.1, 2)} %).`);
  });
  it('Composite inchangé à deux décimales : « stable »', () => {
    expect(chapoSeance({ composite: { valeur: 500, variationPct: 0.004 }, meneur: null, valeurEchangee: null, valeurEchangeeVeille: null }))
      .toBe(`Le BRVM Composite est stable à ${fmtNumber(500, 2)} points.`);
  });
  it('secteur inconnu : phrase omise, aucune invention', () => {
    expect(chapoSeance({ composite: null, meneur: { code: 'XXX', variationPct: 1 }, valeurEchangee: null, valeurEchangeeVeille: null })).toBe('');
  });
  it('secteur stable à deux décimales : phrase omise', () => {
    expect(chapoSeance({ composite: null, meneur: { code: 'BRVMENER', variationPct: 0.004 }, valeurEchangee: null, valeurEchangeeVeille: null })).toBe('');
  });
});
