import { describe, it, expect } from 'vitest';
import { fluxCompteResultat } from './flux';

describe('fluxCompteResultat (STAC 2025, millions)', () => {
  const f = fluxCompteResultat({ chiffreAffaires: 3880, resultatExploitation: -772, resultatAvantImpot: 4.3, resultatNet: -96.6 })!;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  it('équilibre ressources et emplois', () => {
    expect(f.ressources.reduce((a, n) => a + n.valeur, 0)).toBeCloseTo(f.emplois.reduce((a, n) => a + n.valeur, 0), 6);
  });
  it('nœuds attendus', () => {
    expect(f.ressources.map((n) => [n.cle, r1(n.valeur)])).toEqual([['chiffreAffaires', 3880], ['horsExploitation', 776.3], ['perte', 96.6]]);
    expect(f.emplois.map((n) => [n.cle, r1(n.valeur)])).toEqual([['chargesExploitation', 4652], ['impot', 100.9]]);
  });
  it('null si un poste manque', () => {
    expect(fluxCompteResultat({ chiffreAffaires: 3880, resultatExploitation: null, resultatAvantImpot: 4.3, resultatNet: -96.6 })).toBeNull();
  });
  it('bénéficiaire : le bénéfice est un emploi', () => {
    const b = fluxCompteResultat({ chiffreAffaires: 1000, resultatExploitation: 200, resultatAvantImpot: 180, resultatNet: 150 })!;
    expect(b.emplois.map((n) => n.cle)).toEqual(['chargesExploitation', 'horsExploitation', 'impot', 'benefice']);
  });
});
