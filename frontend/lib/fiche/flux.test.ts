import { describe, it, expect } from 'vitest';
import { fluxCompteResultat, fluxBilan } from './flux';

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
  it("CA non comparable (≤ 0 ou inférieur au résultat d'exploitation) : null", () => {
    expect(fluxCompteResultat({ chiffreAffaires: 0, resultatExploitation: -5, resultatAvantImpot: 1, resultatNet: 1 })).toBeNull();
    expect(fluxCompteResultat({ chiffreAffaires: 100, resultatExploitation: 150, resultatAvantImpot: 150, resultatNet: 100 })).toBeNull();
  });
  it('aucun nœud nul, équilibre conservé', () => {
    const b = fluxCompteResultat({ chiffreAffaires: 1000, resultatExploitation: 200, resultatAvantImpot: 200, resultatNet: 200 })!;
    expect([...b.ressources, ...b.emplois].every((n) => n.valeur > 0)).toBe(true);
    expect(b.emplois.map((n) => n.cle)).toEqual(['chargesExploitation', 'benefice']);
    expect(b.ressources.reduce((a, n) => a + n.valeur, 0)).toBeCloseTo(b.emplois.reduce((a, n) => a + n.valeur, 0), 6);
  });
});

describe('fluxBilan (STAC 2025, FCFA)', () => {
  const p = { totalActif: 5446509000, capitauxPropres: 356746000, detteFinanciere: 463307000 };
  it('trois passifs dont les autres passifs en solde', () => {
    const f = fluxBilan(p)!;
    expect(f.actif.valeur).toBe(5446509000);
    expect(f.passifs.map((n) => [n.cle, n.valeur])).toEqual([
      ['capitauxPropres', 356746000], ['detteFinanciere', 463307000], ['autresPassifs', 4626456000],
    ]);
  });
  it('les passifs égalent l’actif', () => {
    const f = fluxBilan(p)!;
    expect(f.passifs.reduce((a, n) => a + n.valeur, 0)).toBe(f.actif.valeur);
  });
  it('null si un terme manque', () => {
    expect(fluxBilan({ ...p, detteFinanciere: null })).toBeNull();
    expect(fluxBilan({ ...p, capitauxPropres: null })).toBeNull();
    expect(fluxBilan({ ...p, totalActif: null })).toBeNull();
  });
  it('null si actif ≤ 0 ou autres passifs négatifs', () => {
    expect(fluxBilan({ ...p, totalActif: 0 })).toBeNull();
    expect(fluxBilan({ ...p, totalActif: 100, capitauxPropres: 80, detteFinanciere: 50 })).toBeNull();
  });
  it('capitaux propres négatifs : pas de bande de hauteur négative', () => {
    expect(fluxBilan({ totalActif: 100, capitauxPropres: -20, detteFinanciere: 30 })).toBeNull();
  });
});
