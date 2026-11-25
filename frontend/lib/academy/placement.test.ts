import { describe, expect, it } from 'vitest';
import { QUESTIONS_PLACEMENT, evaluerPlacement } from './placement';

describe('quiz de placement', () => {
  it('contient 5 questions valides avec explication', () => {
    expect(QUESTIONS_PLACEMENT).toHaveLength(5);
    for (const q of QUESTIONS_PLACEMENT) {
      expect(q.options.length).toBeGreaterThanOrEqual(4);
      expect(q.correct).toBeLessThan(q.options.length);
      expect(q.explication.length).toBeGreaterThan(20);
    }
  });

  it('oriente vers les quatre niveaux selon le score réel', () => {
    const toutesJustes = QUESTIONS_PLACEMENT.map((q) => q.correct);
    const toutesFausses = QUESTIONS_PLACEMENT.map((q) => (q.correct + 1) % q.options.length);

    const n1 = evaluerPlacement(toutesFausses);
    expect(n1.score).toBe(0);
    expect(n1.niveau).toBe('debutant');
    expect(n1.slugRecommande).toBe('academy-niveau-1-initiation');

    const troisJustes = toutesJustes.map((v, i) => (i < 3 ? v : (v + 1) % 4));
    expect(evaluerPlacement(troisJustes).niveau).toBe('intermediaire');

    const quatreJustes = toutesJustes.map((v, i) => (i < 4 ? v : (v + 1) % 4));
    expect(evaluerPlacement(quatreJustes).niveau).toBe('avance');

    const n4 = evaluerPlacement(toutesJustes);
    expect(n4.score).toBe(5);
    expect(n4.niveau).toBe('expert');
    expect(n4.slugRecommande).toBe('academy-niveau-4-expert');
  });
});
