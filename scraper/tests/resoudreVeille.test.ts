import { describe, it, expect } from 'vitest';
import { resoudreVeille } from '../src/scrapers/brvmPublic.js';

describe('resoudreVeille', () => {
  it('LE BUG RÉEL : brvm.org roule « veille » vers le cours du jour → on redérive', () => {
    // UNLC, séance du 2026-07-13. La source publiait veille = 53 735 (= le cours
    // du jour !) alors que la clôture de la veille était réellement 50 500.
    // La variation, elle, était juste : +6,41 %.
    const v = resoudreVeille(53735, 53735, 6.41);
    expect(v).not.toBe(53735); // surtout PAS la valeur publiée
    expect(v).toBeGreaterThan(50400);
    expect(v).toBeLessThan(50600); // ≈ 50 498, la vraie clôture était 50 500
  });

  it('une veille publiée COHÉRENTE est conservée telle quelle', () => {
    // 50 000 → 53 735 = +7,47 %. La source est fiable ici : on n'y touche pas.
    expect(resoudreVeille(50000, 53735, 7.47)).toBe(50000);
  });

  it('variation nulle : la veille égale le cours, et ce n’est PAS une anomalie', () => {
    // Sur la BRVM, la plupart des titres ne bougent pas : veille == cours est
    // alors parfaitement normal. Ne pas le « corriger ».
    expect(resoudreVeille(3125, 3125, 0)).toBe(3125);
  });

  it('veille publiée absente : on dérive', () => {
    const v = resoudreVeille(null, 10500, 5);
    expect(v).toBe(10000);
  });

  it('sans cours ni variation : on rend ce qu’on a, sans inventer', () => {
    expect(resoudreVeille(4200, null, 3)).toBe(4200);
    expect(resoudreVeille(4200, 4300, null)).toBe(4200);
    expect(resoudreVeille(null, null, null)).toBe(null);
  });

  it('−100 % : aucune division par zéro', () => {
    expect(() => resoudreVeille(100, 0, -100)).not.toThrow();
    expect(resoudreVeille(100, 0, -100)).toBe(100);
  });

  it('tolère l’arrondi de la source (on ne rejette pas pour un centime)', () => {
    // 6 400 → 6 480 = +1,25 %. Publiée 6 400 : cohérente à l'arrondi près.
    expect(resoudreVeille(6400, 6480, 1.25)).toBe(6400);
  });
});
