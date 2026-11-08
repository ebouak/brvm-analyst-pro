import { describe, it, expect } from 'vitest';
import { estProse, classeValeur } from './prose';

describe('estProse', () => {
  it('chiffres, unités et signes : pas de prose', () => {
    for (const v of ['4,3 Md FCFA', '12,3x', '−5,2 %', '+3,4 %', '—', '1 234 FCFA']) expect(estProse(v)).toBe(false);
  });
  it('mots : prose', () => {
    for (const v of ['non calculable', 'non calculable, perte', 'perte réduite de 23,4 %', 'retour au bénéfice']) expect(estProse(v)).toBe(true);
  });
  it('classe : mono pour les chiffres, rien pour la prose', () => {
    expect(classeValeur('12,3x')).toBe('tabular');
    expect(classeValeur('non calculable')).toBe('');
  });
});
