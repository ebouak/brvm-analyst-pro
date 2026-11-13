import { describe, it, expect } from 'vitest';
import { limiteAlertes, refusCreation } from './limite';

describe('limite des alertes', () => {
  it('Premium : illimité, tous types', () => {
    expect(limiteAlertes(true, 1)).toBeNull();
    expect(refusCreation({ premium: true, limite: null, existantes: 40, type: 'signal_achat' })).toBeNull();
  });
  it('gratuit : une alerte de prix', () => {
    expect(limiteAlertes(false, 1)).toBe(1);
    expect(refusCreation({ premium: false, limite: 1, existantes: 0, type: 'prix_au_dessus' })).toBeNull();
    expect(refusCreation({ premium: false, limite: 1, existantes: 1, type: 'prix_au_dessus' })).toMatch(/1 alerte/);
  });
  it('gratuit : pas d’alerte de signal (contenu Premium)', () => {
    expect(refusCreation({ premium: false, limite: 1, existantes: 0, type: 'signal_achat' })).toMatch(/prix/);
  });
  it('quota absent ou nul : aucune alerte en gratuit', () => {
    expect(limiteAlertes(false, null)).toBe(0);
    expect(refusCreation({ premium: false, limite: 0, existantes: 0, type: 'variation' })).toMatch(/réservées/);
  });
});
