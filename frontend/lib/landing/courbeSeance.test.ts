import { describe, it, expect } from 'vitest';
import { courbeSeance, largeurMarche } from './courbeSeance';

const p = (...v: number[]) => v.map((x, i) => ({ d: `2026-11-0${i + 1}`, v: x }));

describe('courbeSeance', () => {
  it('place le plus bas en bas et le plus haut en haut de la zone', () => {
    const c = courbeSeance(p(500, 520, 510), 200, 100, 8)!;
    expect(c.ligne).toBe('M0 92 L100 8 L200 50');
    expect(c).toMatchObject({ min: 500, max: 520, finX: 200, finY: 50 });
  });

  it('ferme l’aire sur la ligne de base', () => {
    expect(courbeSeance(p(1, 2), 100, 50, 0)!.aire).toBe('M0 50 L100 0 L100 50 L0 50 Z');
  });

  it('ne trace rien sous deux points : une ligne plate ferait croire à un marché immobile', () => {
    expect(courbeSeance([], 100, 50)).toBeNull();
    expect(courbeSeance(p(500), 100, 50)).toBeNull();
  });

  it('écarte les points invalides', () => {
    expect(courbeSeance(p(0, 500, Number.NaN), 100, 50)).toBeNull();
  });

  it('reste valide si toutes les valeurs sont égales', () => {
    expect(courbeSeance(p(500, 500), 100, 50, 0)!.ligne).toBe('M0 50 L100 50');
  });
});

describe('largeurMarche', () => {
  it('totalise exactement 100 (séance réelle : 25, 9, 14)', () => {
    const r = largeurMarche(25, 9, 14)!;
    expect(r).toEqual({ hausses: 52, stables: 19, baisses: 29 });
    expect(r.hausses + r.stables + r.baisses).toBe(100);
  });

  it('ne divise pas par zéro', () => {
    expect(largeurMarche(0, 0, 0)).toBeNull();
  });
});
