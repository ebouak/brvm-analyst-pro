// frontend/lib/forum/identity.test.ts
import { describe, it, expect } from 'vitest';
import { displayName, relativeTimeFR } from './identity';

describe('displayName', () => {
  it('utilise le pseudonyme si présent', () => {
    expect(displayName({ id: 'u1', display_name: 'Koffi' })).toBe('Koffi');
  });
  it("repli « Membre » si pseudonyme absent (jamais l'email)", () => {
    expect(displayName({ id: 'u1', display_name: null })).toBe('Membre');
  });
  it('« Utilisateur supprimé » si auteur null (anonymisé)', () => {
    expect(displayName(null)).toBe('Utilisateur supprimé');
  });
  it('trim et repli si pseudonyme vide', () => {
    expect(displayName({ id: 'u1', display_name: '   ' })).toBe('Membre');
  });
});

describe('relativeTimeFR', () => {
  const now = new Date('2026-06-19T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it('à l\'instant sous une minute', () => {
    expect(relativeTimeFR(ago(30_000), now)).toBe("à l'instant");
  });
  it('minutes', () => {
    expect(relativeTimeFR(ago(5 * 60_000), now)).toBe('5 min');
  });
  it('heures', () => {
    expect(relativeTimeFR(ago(3 * 3_600_000), now)).toBe('3 h');
  });
  it('jours', () => {
    expect(relativeTimeFR(ago(2 * 86_400_000), now)).toBe('2 j');
  });
  it('semaines', () => {
    expect(relativeTimeFR(ago(14 * 86_400_000), now)).toBe('2 sem');
  });
  it('date future tolérée → à l\'instant', () => {
    expect(relativeTimeFR(ago(-10_000), now)).toBe("à l'instant");
  });
});
