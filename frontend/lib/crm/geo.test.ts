import { describe, it, expect } from 'vitest';
import { continentDe, UEMOA, estUemoa, nomPays, paysValide, doitMajPays, CONTINENTS_AFRIQUE } from './geo';

describe('continentDe', () => {
  it('couvre les 54 pays africains', () => {
    expect(CONTINENTS_AFRIQUE).toHaveLength(54);
    for (const c of CONTINENTS_AFRIQUE) expect(continentDe(c), c).toBe('Afrique');
  });
  it('classe les principaux pays hors Afrique', () => {
    expect(continentDe('FR')).toBe('Europe');
    expect(continentDe('CA')).toBe('Amérique du Nord');
    expect(continentDe('BR')).toBe('Amérique du Sud');
    expect(continentDe('CN')).toBe('Asie');
    expect(continentDe('AU')).toBe('Océanie');
  });
  it('null si inconnu ou vide ; insensible à la casse', () => {
    expect(continentDe('ZZ')).toBeNull();
    expect(continentDe(null)).toBeNull();
    expect(continentDe('fr')).toBe('Europe');
  });
});

describe('UEMOA', () => {
  it('huit pays, tous africains', () => {
    expect(UEMOA).toHaveLength(8);
    expect(UEMOA.every((c) => continentDe(c) === 'Afrique')).toBe(true);
    expect(estUemoa('CI')).toBe(true);
    expect(estUemoa('cm')).toBe(false);
    expect(estUemoa(null)).toBe(false);
  });
});

describe('nomPays', () => {
  it('nom français, repli sur le code', () => {
    expect(nomPays('CI')).toBe("Côte d'Ivoire");
    expect(nomPays('SN')).toBe('Sénégal');
    expect(nomPays('FR')).toBe('France');
    expect(nomPays('QQ')).toBe('QQ');
    expect(nomPays(null)).toBe('—');
  });
  it('nomme chaque pays africain', () => {
    for (const c of CONTINENTS_AFRIQUE) expect(nomPays(c), c).not.toBe(c);
  });
});

describe('paysValide', () => {
  it('deux majuscules, hors XX / T1', () => {
    expect(paysValide('CI')).toBe('CI');
    expect(paysValide('ci')).toBeNull();
    for (const v of ['XX', 'T1', 'FRA', '', null, undefined, '1A']) expect(paysValide(v)).toBeNull();
  });
});

describe('doitMajPays', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  it('met à jour si inconnu, si le pays change, ou si 24 h écoulées', () => {
    expect(doitMajPays({ pays_code: null, pays_maj_le: null }, 'CI', now)).toBe(true);
    expect(doitMajPays({ pays_code: 'CI', pays_maj_le: '2026-11-01T11:00:00Z' }, 'FR', now)).toBe(true);
    expect(doitMajPays({ pays_code: 'CI', pays_maj_le: '2026-10-31T11:00:00Z' }, 'CI', now)).toBe(true);
  });
  it('saute si même pays et mise à jour récente', () => {
    expect(doitMajPays({ pays_code: 'CI', pays_maj_le: '2026-11-01T11:00:00Z' }, 'CI', now)).toBe(false);
  });
});
