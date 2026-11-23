import { describe, expect, it } from 'vitest';
import { comparerDerniersReleves } from './dernierReleve';

const r = (code: string, captured_at: string, close: number | string | null, volume: number | null = null) => ({ code, captured_at, close, volume });
const T1 = '2026-11-23T12:00:58Z';
const T2 = '2026-11-23T12:15:56Z';
const T0 = '2026-11-23T11:45:59Z';

describe('comparerDerniersReleves', () => {
  it('compare les deux derniers relevés, du plus fort mouvement au plus faible', () => {
    const c = comparerDerniersReleves([
      r('SNTS', T0, 4050, 100), r('SNTS', T1, 4040, 200), r('SNTS', T2, 3995, 260),
      r('SGBC', T1, 38000, 50), r('SGBC', T2, 38500, 50),
      r('ORAC', T1, 15000, 10), r('ORAC', T2, 15000, 30),
    ])!;
    expect(c.instant).toBe(T2);
    expect(c.instantPrecedent).toBe(T1);
    expect(c.mouvements.map((m) => m.code)).toEqual(['SGBC', 'SNTS']);
    const snts = c.mouvements.find((m) => m.code === 'SNTS')!;
    expect(snts.avant).toBe(4040);
    expect(snts.apres).toBe(3995);
    expect(snts.titres).toBe(60);
    expect(snts.variationPct).toBeCloseTo(-1.1139, 3);
  });

  it('titres non lisibles (volume absent ou sans écart) : null, jamais inventé', () => {
    const c = comparerDerniersReleves([r('SGBC', T1, 38000, 50), r('SGBC', T2, 38500, 50), r('X', T1, 100, null), r('X', T2, 101, 20)])!;
    expect(c.mouvements.every((m) => m.titres === null)).toBe(true);
  });

  it('relevé sans aucun mouvement : liste vide, pas fusionné avec le précédent', () => {
    const c = comparerDerniersReleves([r('SNTS', T1, 4040), r('SNTS', T2, 4040)])!;
    expect(c.instant).toBe(T2);
    expect(c.mouvements).toEqual([]);
  });

  it('cours nul, absent ou valeur nouvelle : écartés ; chaînes numériques lues', () => {
    const c = comparerDerniersReleves([
      r('A', T1, null), r('A', T2, 100),
      r('B', T2, 50),
      r('C', T1, '200'), r('C', T2, '210'),
      r('D', T1, 0), r('D', T2, 10),
    ])!;
    expect(c.mouvements.map((m) => m.code)).toEqual(['C']);
  });

  it('un seul relevé dans la journée : null', () => {
    expect(comparerDerniersReleves([r('SNTS', T2, 3995)])).toBeNull();
    expect(comparerDerniersReleves([])).toBeNull();
  });
});
