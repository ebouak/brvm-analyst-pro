import { describe, expect, it } from 'vitest';
import { fraicheurComptes } from './fraicheur';

describe('fraicheurComptes (clôture au 31/12, ancien au-delà de 18 mois)', () => {
  const auj = new Date('2026-11-10T00:00:00Z');
  it('2025 : limite 30/06/2027, à jour', () => {
    expect(fraicheurComptes(2025, auj)).toEqual({ exercice: 2025, ancien: false });
  });
  it('2024 : limite 30/06/2026 dépassée, ancien', () => {
    expect(fraicheurComptes(2024, auj)).toEqual({ exercice: 2024, ancien: true });
  });
  it('sans exercice : null', () => {
    expect(fraicheurComptes(null, auj)).toBeNull();
  });
});
