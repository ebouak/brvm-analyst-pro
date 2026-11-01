import { describe, it, expect } from 'vitest';
import { nextSur, estNouveauCompte, versEcranWhatsapp } from './redirection';

const M = new Date('2026-11-02T10:00:00Z');

describe('redirection', () => {
  it('nextSur garde un chemin interne', () => expect(nextSur('/societes/SNTS?x=1')).toBe('/societes/SNTS?x=1'));
  it('nextSur refuse un domaine externe', () => {
    for (const n of ['//evil.com', 'https://evil.com', '/\\evil.com', '', null, undefined]) expect(nextSur(n)).toBe('/dashboard');
  });
  it('nouveau compte = créé il y a moins de 24 h', () => {
    expect(estNouveauCompte('2026-11-02T08:00:00Z', M)).toBe(true);
    expect(estNouveauCompte('2026-11-01T09:59:00Z', M)).toBe(false);
    expect(estNouveauCompte(undefined, M)).toBe(false);
  });
  it("l'URL de l'écran encode la destination", () => {
    expect(versEcranWhatsapp('/bienvenue')).toBe('/bienvenue/whatsapp?next=%2Fbienvenue');
  });
});
