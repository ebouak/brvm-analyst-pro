import { describe, it, expect } from 'vitest';
import { decomposerScore, calculeEstAncien } from './quant';

const piliers = [
  { poids: 30, valeur: 80 }, { poids: 25, valeur: 60 }, { poids: 20, valeur: 50 }, { poids: 15, valeur: 40 }, { poids: 10, valeur: 70 },
];

describe('decomposerScore', () => {
  it('somme pondérée, pénalité = somme − score', () => {
    const d = decomposerScore(piliers, 55)!;
    // 24 + 15 + 10 + 6 + 7 = 62
    expect(d.sommePonderee).toBeCloseTo(62, 6);
    expect(d.penalite).toBeCloseTo(7, 6);
    expect(d.score).toBe(55);
  });
  it('redistribue le poids d\'un pilier manquant', () => {
    const d = decomposerScore([{ poids: 50, valeur: 80 }, { poids: 50, valeur: null }], 70)!;
    expect(d.sommePonderee).toBeCloseTo(80, 6);
    expect(d.penalite).toBeCloseTo(10, 6);
  });
  it('null sans score ou sans pilier', () => {
    expect(decomposerScore(piliers, null)).toBeNull();
    expect(decomposerScore([{ poids: 10, valeur: null }], 50)).toBeNull();
  });
  it('pénalité jamais négative', () => {
    expect(decomposerScore([{ poids: 100, valeur: 40 }], 45)!.penalite).toBe(0);
  });
});

describe('calculeEstAncien', () => {
  it('vrai si le calcul précède la dernière séance', () => {
    expect(calculeEstAncien('2026-11-05', '2026-11-06')).toBe(true);
    expect(calculeEstAncien('2026-11-06', '2026-11-06')).toBe(false);
    expect(calculeEstAncien('2026-11-06', null)).toBe(false);
  });
});
