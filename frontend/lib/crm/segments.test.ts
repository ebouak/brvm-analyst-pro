import { describe, it, expect } from 'vitest';
import { dansZone, aInteretFormation, estZone, ZONES } from './segments';

describe('dansZone', () => {
  it('Afrique inclut l’UEMOA ; UEMOA est plus étroit', () => {
    expect(dansZone('CI', 'afrique')).toBe(true);
    expect(dansZone('CI', 'uemoa')).toBe(true);
    expect(dansZone('CM', 'afrique')).toBe(true);
    expect(dansZone('CM', 'uemoa')).toBe(false);
  });
  it('Europe, Autres, Inconnu sont disjoints d’Afrique', () => {
    expect(dansZone('FR', 'europe')).toBe(true);
    expect(dansZone('FR', 'afrique')).toBe(false);
    expect(dansZone('CA', 'autres')).toBe(true);
    expect(dansZone('FR', 'autres')).toBe(false);
    expect(dansZone('CI', 'autres')).toBe(false);
    expect(dansZone(null, 'inconnu')).toBe(true);
    expect(dansZone('ZZ', 'inconnu')).toBe(true);
    expect(dansZone('CI', 'inconnu')).toBe(false);
  });
  it('« tous » laisse tout passer, y compris l’inconnu', () => {
    expect(dansZone(null, 'tous')).toBe(true);
    expect(dansZone('FR', 'tous')).toBe(true);
  });
  it('chaque pays tombe dans exactement une zone parmi europe / afrique / autres / inconnu', () => {
    for (const p of ['CI', 'FR', 'CA', 'CN', null, 'ZZ']) {
      expect((['afrique', 'europe', 'autres', 'inconnu'] as const).filter((z) => dansZone(p, z))).toHaveLength(1);
    }
  });
});

describe('aInteretFormation', () => {
  it('vrai avec des pages consultées ou des leçons suivies', () => {
    expect(aInteretFormation({ formationVues: [{ page: '/formations/academy', jour: '2026-10-30' }], leconsAcademy: 0 })).toBe(true);
    expect(aInteretFormation({ formationVues: [], leconsAcademy: 1 })).toBe(true);
    expect(aInteretFormation({ formationVues: [], leconsAcademy: 0 })).toBe(false);
  });
});

describe('estZone', () => {
  it('valide la liste', () => {
    for (const z of ZONES) expect(estZone(z)).toBe(true);
    expect(estZone('asie')).toBe(false);
    expect(estZone(undefined)).toBe(false);
  });
});
