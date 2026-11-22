import { describe, it, expect } from 'vitest';
import { colonnesRoulant } from './roulant';

describe('colonnesRoulant', () => {
  it('sépare chiffres et autres caractères', () => {
    expect(colonnesRoulant('25 800')).toEqual([
      { cle: 'c6', chiffre: 2 },
      { cle: 'c5', chiffre: 5 },
      { cle: 'c4', caractere: ' ' },
      { cle: 'c3', chiffre: 8 },
      { cle: 'c2', chiffre: 0 },
      { cle: 'c1', chiffre: 0 },
    ]);
  });

  it('garde les unités dans la même colonne quand la longueur change', () => {
    const a = colonnesRoulant('999');
    const b = colonnesRoulant('1 000');
    expect(a[a.length - 1]!.cle).toBe(b[b.length - 1]!.cle);
  });
});
