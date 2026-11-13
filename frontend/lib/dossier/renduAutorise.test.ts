import { describe, expect, it } from 'vitest';
import { secretRenduValide } from './renduAutorise';

const S = 'a'.repeat(40);

describe('secretRenduValide', () => {
  it('accepte le bon secret', () => expect(secretRenduValide(S, S)).toBe(true));
  it('refuse un secret faux, même de même longueur', () => expect(secretRenduValide(S, 'a'.repeat(39) + 'b')).toBe(false));
  it('refuse un préfixe du secret', () => expect(secretRenduValide(S, S.slice(0, 20))).toBe(false));
  it('refuse sans en-tête', () => {
    expect(secretRenduValide(S, null)).toBe(false);
    expect(secretRenduValide(S, '')).toBe(false);
  });
  it('refuse si le secret attendu manque ou fait moins de 32 caractères', () => {
    expect(secretRenduValide(undefined, S)).toBe(false);
    expect(secretRenduValide('court', 'court')).toBe(false);
  });
});
