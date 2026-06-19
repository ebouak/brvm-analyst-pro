// frontend/lib/forum/identity.test.ts
import { describe, it, expect } from 'vitest';
import { displayName } from './identity';

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
