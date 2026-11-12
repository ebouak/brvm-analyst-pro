import { describe, expect, it } from 'vitest';
import { libellePeriode } from './periode';

describe('libellePeriode', () => {
  it.each([
    ['T1-2026', '1er trimestre 2026'],
    ['T3-2026', '3e trimestre 2026'],
    ['S2-2025', '2e semestre 2025'],
    ['9M-2026', '9 mois 2026'],
    ['A-2025', 'exercice 2025'],
  ])('%s', (code, attendu) => expect(libellePeriode(code)).toBe(attendu));
  it('inconnu ou absent : null', () => {
    expect(libellePeriode(null)).toBeNull();
    expect(libellePeriode('X-1')).toBeNull();
  });
});
