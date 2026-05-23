import { describe, it, expect } from 'vitest';
import { isTriggered } from '../src/alerts/evaluate.js';

describe('isTriggered', () => {
  it('prix_au_dessus', () => {
    expect(isTriggered({ type: 'prix_au_dessus', seuil: 100 }, 105, null)).toBe(true);
    expect(isTriggered({ type: 'prix_au_dessus', seuil: 100 }, 95, null)).toBe(false);
    expect(isTriggered({ type: 'prix_au_dessus', seuil: 100 }, null, null)).toBe(false);
  });
  it('prix_en_dessous', () => {
    expect(isTriggered({ type: 'prix_en_dessous', seuil: 100 }, 95, null)).toBe(true);
    expect(isTriggered({ type: 'prix_en_dessous', seuil: 100 }, 105, null)).toBe(false);
  });
  it('variation (valeur absolue)', () => {
    expect(isTriggered({ type: 'variation', seuil: 5 }, null, -6)).toBe(true);
    expect(isTriggered({ type: 'variation', seuil: 5 }, null, 3)).toBe(false);
  });
});
