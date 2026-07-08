// frontend/lib/forum/identity.test.ts
import { describe, it, expect } from 'vitest';
import { displayName, relativeTimeFR } from './identity';

describe('displayName', () => {
  const mockProfile = (userId: string, displayName?: string | null): import('./types').AuthorProfile => ({
    user_id: userId,
    avatar_url: null,
    display_name: displayName ?? '',
    is_verified: false,
    reputation_score: 0,
    created_at: new Date().toISOString(),
  });

  it('utilise le pseudonyme si présent', () => {
    expect(displayName(mockProfile('u1', 'Koffi'))).toBe('Koffi');
  });
  it("repli pseudo DISTINCT et stable si pseudonyme absent (jamais l'email)", () => {
    const a = displayName(mockProfile('u1', null));
    const b = displayName(mockProfile('u2', null));
    expect(a).toMatch(/^Membre-[0-9A-Z]{4}$/);
    expect(a).not.toBe(b); // deux auteurs → deux pseudos distincts
    expect(displayName(mockProfile('u1', null))).toBe(a); // stable
  });
  it('« Utilisateur supprimé » si auteur null (anonymisé)', () => {
    expect(displayName(null)).toBe('Utilisateur supprimé');
  });
  it('trim et repli si pseudonyme vide', () => {
    expect(displayName(mockProfile('u1', '   '))).toMatch(/^Membre-[0-9A-Z]{4}$/);
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
