import { describe, expect, it } from 'vitest';
import { BORNES, borner, phraseOmis } from './bornes';

describe('borner', () => {
  it('garde les premiers éléments et compte les omis', () => {
    expect(borner([1, 2, 3, 4, 5], 3)).toEqual({ affichees: [1, 2, 3], omis: 2 });
  });
  it('rien d’omis sous la borne ; borne négative = tout omis', () => {
    expect(borner([1, 2], 5)).toEqual({ affichees: [1, 2], omis: 0 });
    expect(borner([1, 2], -1)).toEqual({ affichees: [], omis: 2 });
    expect(borner([], 3).omis).toBe(0);
  });
  it('les bornes du dossier sont positives', () => {
    for (const v of Object.values(BORNES)) expect(v).toBeGreaterThan(0);
  });
});

describe('phraseOmis', () => {
  it('singulier, pluriel, rien', () => {
    expect(phraseOmis(0, 'réserve', 'f')).toBeNull();
    expect(phraseOmis(1, 'réserve', 'f')).toBe('… et 1 autre réserve');
    expect(phraseOmis(3, 'réserve', 'f')).toBe('… et 3 autres réserves');
    expect(phraseOmis(2, 'date', 'f')).toBe('… et 2 autres dates');
  });
});
