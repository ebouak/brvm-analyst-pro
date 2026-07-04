import { describe, it, expect } from 'vitest';
import { computeLiquidity, classifyLiquidity } from './liquidity';

describe('computeLiquidity', () => {
  it('titre très liquide : traite chaque séance avec forte valeur → classe A', () => {
    const rows = Array.from({ length: 20 }, () => ({
      volume: 10_000,
      cours_jour: 15_000, // 150 M FCFA/séance
      valeur_echangee: null,
    }));
    const r = computeLiquidity(rows, 20)!;
    expect(r.presencePct).toBe(100);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.classe).toBe('A');
  });

  it('titre qui ne traite jamais → score 0, classe D', () => {
    const rows = Array.from({ length: 20 }, () => ({ volume: 0, cours_jour: 5000 }));
    const r = computeLiquidity(rows, 20)!;
    expect(r.score).toBe(0);
    expect(r.classe).toBe('D');
    expect(r.presencePct).toBe(0);
  });

  it('les séances absentes comptent comme non traitées (jamais gonflé)', () => {
    // 5 lignes seulement sur 20 séances de marché
    const rows = Array.from({ length: 5 }, () => ({ volume: 100, cours_jour: 1000 }));
    const r = computeLiquidity(rows, 20)!;
    expect(r.presencePct).toBe(25);
  });

  it('utilise valeur_echangee quand disponible plutôt que cours×volume', () => {
    const withVE = computeLiquidity([{ volume: 1, cours_jour: 1, valeur_echangee: 50_000_000 }], 1)!;
    const withoutVE = computeLiquidity([{ volume: 1, cours_jour: 1 }], 1)!;
    expect(withVE.valeurMoyenne).toBe(50_000_000);
    expect(withVE.score).toBeGreaterThan(withoutVE.score);
  });

  it('zéro séance de marché → null (pas de score inventé)', () => {
    expect(computeLiquidity([], 0)).toBeNull();
  });

  it('classes aux bons seuils', () => {
    expect(classifyLiquidity(75)).toBe('A');
    expect(classifyLiquidity(74)).toBe('B');
    expect(classifyLiquidity(50)).toBe('B');
    expect(classifyLiquidity(49)).toBe('C');
    expect(classifyLiquidity(25)).toBe('C');
    expect(classifyLiquidity(24)).toBe('D');
  });
});
