import { describe, expect, it } from 'vitest';
import { secretRenduDossierValide } from './renderSecret';

const SECRET = 'a'.repeat(40);

describe('secretRenduDossierValide', () => {
  it('n’accepte que le secret exact et assez long', () => {
    expect(secretRenduDossierValide(SECRET, SECRET)).toBe(true);
    expect(secretRenduDossierValide(SECRET, SECRET + 'x')).toBe(false);
    expect(secretRenduDossierValide(SECRET, null)).toBe(false);
    expect(secretRenduDossierValide('court', 'court')).toBe(false);
  });
});
