import { describe, expect, it } from 'vitest';
import { evaluerAccesDossier } from './accesPur';

const NOW = new Date('2026-11-18T22:00:00Z');

describe('evaluerAccesDossier', () => {
  it('ouvre tout pour Premium', () => {
    expect(evaluerAccesDossier('SNTS', true, [], NOW)).toEqual({ complet: true, motif: 'premium' });
  });

  it('ouvre uniquement le code acheté et encore valide', () => {
    expect(evaluerAccesDossier('SNTS', false, [
      { product_code: 'dossier:SNTS', expires_at: null, revoked_at: null },
    ], NOW)).toEqual({ complet: true, motif: 'achete' });
    expect(evaluerAccesDossier('PALC', false, [
      { product_code: 'dossier:SNTS', expires_at: null, revoked_at: null },
    ], NOW)).toEqual({ complet: false, motif: 'verrouille' });
  });

  it('refuse un droit expiré ou révoqué', () => {
    expect(evaluerAccesDossier('SNTS', false, [
      { product_code: 'dossier:SNTS', expires_at: '2026-11-01T00:00:00Z', revoked_at: null },
    ], NOW)).toEqual({ complet: false, motif: 'verrouille' });
    expect(evaluerAccesDossier('SNTS', false, [
      { product_code: 'dossier:SNTS', expires_at: null, revoked_at: '2026-11-10T00:00:00Z' },
    ], NOW)).toEqual({ complet: false, motif: 'verrouille' });
  });

  it('normalise le code et refuse une entrée invalide', () => {
    expect(evaluerAccesDossier('snts', false, [
      { product_code: 'dossier:SNTS', expires_at: null, revoked_at: null },
    ], NOW)).toEqual({ complet: true, motif: 'achete' });
    expect(evaluerAccesDossier('../SNTS', false, [], NOW)).toEqual({ complet: false, motif: 'verrouille' });
  });
});
