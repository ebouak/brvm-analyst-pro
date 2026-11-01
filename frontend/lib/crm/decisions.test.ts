import { describe, it, expect } from 'vitest';
import { validerEcheance, estMotif, estUuid, contenuCloture, contenuEcheance } from './decisions';

const MAINT = new Date('2026-11-01T12:00:00Z');

describe('validerEcheance', () => {
  it('accepte aujourd\'hui et la limite d\'un an', () => {
    expect(validerEcheance('2026-11-01', MAINT)).toEqual({ ok: true, date: '2026-11-01' });
    expect(validerEcheance('2027-11-01', MAINT).ok).toBe(true);
  });
  it('refuse le passé, au-delà d\'un an, et les dates irréelles ou mal formées', () => {
    expect(validerEcheance('2026-10-31', MAINT).ok).toBe(false);
    expect(validerEcheance('2027-11-02', MAINT).ok).toBe(false);
    expect(validerEcheance('2026-02-30', MAINT).ok).toBe(false);
    expect(validerEcheance('01/11/2026', MAINT).ok).toBe(false);
    expect(validerEcheance(undefined, MAINT).ok).toBe(false);
  });
});

describe('gardes et libellés', () => {
  it('motifs et uuid', () => {
    expect(estMotif('doublon')).toBe(true);
    expect(estMotif('autre')).toBe(false);
    expect(estUuid('5b8b4f0e-1c2d-4e3f-8a9b-0c1d2e3f4a5b')).toBe(true);
    expect(estUuid('x')).toBe(false);
  });
  it('contenu lisible', () => {
    expect(contenuCloture('deja_abonne')).toBe('Clôturé : déjà abonné');
    expect(contenuEcheance('2026-11-05')).toBe('Suivi prévu le 05/11');
  });
});
