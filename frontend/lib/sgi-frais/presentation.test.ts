import { describe, it, expect } from 'vitest';
import { decomposerCout, largeurBarre } from './presentation';
import type { CoutSGIResult } from './calculateur';

const r = (over: Partial<CoutSGIResult>): CoutSGIResult => ({
  sgiNom: 'Test', coutCourtage: 0, coutReglementaire: 0, coutGarde: 0, coutTenue: 0, coutVirement: 0,
  total: 0, pctCapital: 0, champsManquants: [], ...over,
});

describe('decomposerCout', () => {
  it('donne chaque poste non nul avec sa part du total', () => {
    const s = decomposerCout(r({ coutCourtage: 4_000, coutReglementaire: 6_000, coutGarde: 5_000, coutTenue: 4_000, total: 19_000 }));
    expect(s.map((x) => x.cle)).toEqual(['courtage', 'reglementaire', 'garde', 'tenue']);
    expect(s.reduce((t, x) => t + x.part, 0)).toBeCloseTo(100, 6);
    expect(s[1].montant).toBe(6_000);
  });

  it('omet les postes nuls (pas de segment vide)', () => {
    const s = decomposerCout(r({ coutCourtage: 10_000, total: 10_000 }));
    expect(s).toHaveLength(1);
    expect(s[0].part).toBe(100);
  });

  it('total nul : aucune division par zéro', () => {
    expect(decomposerCout(r({}))).toEqual([]);
  });
});

describe('largeurBarre', () => {
  it('proportion du plus cher, en pourcentage', () => {
    expect(largeurBarre(19_000, 38_000)).toBe(50);
    expect(largeurBarre(38_000, 38_000)).toBe(100);
  });

  it('un coût non nul reste visible, un maximum nul ne casse rien', () => {
    expect(largeurBarre(1, 1_000_000)).toBe(2);
    expect(largeurBarre(0, 0)).toBe(0);
  });
});
