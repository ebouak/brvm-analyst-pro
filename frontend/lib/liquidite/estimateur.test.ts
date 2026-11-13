import { describe, it, expect } from 'vitest';
import { estimerSeances } from './estimateur';

describe('estimerSeances', () => {
  it('titre liquide : une séance suffit', () => {
    expect(estimerSeances(2e6, 1.58e9)).toEqual({ seances: 1, parSeance: 1.58e9 * 0.2 });
  });
  it('titre peu échangé : 2 M ÷ (20 % × 1 M) = 10 séances', () => {
    expect(estimerSeances(2e6, 1e6)!.seances).toBe(10);
  });
  it('sans donnée : pas d’estimation', () => {
    expect(estimerSeances(2e6, null)).toBeNull();
    expect(estimerSeances(0, 1e6)).toBeNull();
  });
});
