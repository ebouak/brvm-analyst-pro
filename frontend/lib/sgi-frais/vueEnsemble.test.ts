import { describe, it, expect } from 'vitest';
import type { Sgi } from './directory';
import type { SgiFrais } from './types';
import { arcsAnneau, syntheseVueEnsemble } from './vueEnsemble';
import { SCENARIO_DEFAUT } from './scenario';

const sgi = (nom: string): Sgi => ({ nom, pays: 'CI', type: 'Indépendante', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' });
const frais = (sgiNom: string, p: Partial<SgiFrais> = {}): SgiFrais => ({
  sgiNom,
  courtagePctMin: null,
  courtagePctMax: 1,
  minimumPerception: null,
  droitsGardePctMin: null,
  droitsGardePctMax: 0.3,
  droitsGardeFrequence: 'annuel',
  droitsGardeMinimum: null,
  tenueCompteMontant: 0,
  tenueCompteFrequence: 'annuel',
  fraisVirement: null,
  depotMinimum: null,
  gestionSousMandatPctMin: null,
  gestionSousMandatPctMax: null,
  confiance: 'homologue_crepmf',
  sourceUrl: null,
  sourceLabel: null,
  verifieLe: null,
  notes: null,
  ...p,
});

describe('vue d’ensemble du comparateur', () => {
  const dir = [sgi('Chère'), sgi('Moyenne'), sgi('Trou'), sgi('Sans barème')];
  const fr = [
    frais('Chère', { courtagePctMax: 1 }),
    frais('Moyenne', { courtagePctMax: 0.75 }),
    // Garde inconnue : coût le plus bas en apparence, mais sous-estimé.
    frais('Trou', { courtagePctMax: 0.1, droitsGardePctMax: null }),
    frais('Orpheline'), // barème sans fiche d'annuaire : ignoré
  ];
  const s = syntheseVueEnsemble(dir, fr, SCENARIO_DEFAUT);

  it('ne recommande jamais un barème incomplet, même le moins cher en apparence', () => {
    expect(s.recommandee?.sgi.nom).toBe('Moyenne');
    expect(s.classement.map((l) => l.sgi.nom)).toEqual(['Moyenne', 'Chère', 'Trou']);
    expect(s.nbComplets).toBe(2);
  });

  it('la somme des postes égale le coût total recommandé', () => {
    const somme = s.postes.reduce((a, p) => a + p.montant, 0);
    expect(somme).toBeCloseTo(s.recommandee!.cout.total);
    expect(s.postes.some((p) => p.cle === 'virement')).toBe(false); // nul : non affiché
    expect(s.seuilPct).toBeGreaterThan(0);
  });

  it('sans aucun barème complet : ni recommandation, ni postes', () => {
    const v = syntheseVueEnsemble([sgi('Trou')], [frais('Trou', { droitsGardePctMax: null })], SCENARIO_DEFAUT);
    expect(v.recommandee).toBeNull();
    expect(v.postes).toEqual([]);
    expect(v.seuilPct).toBeNull();
  });

  it('l’anneau couvre exactement un tour, sans part négative', () => {
    const a = arcsAnneau([1, 3, 0, -2]);
    expect(a.reduce((x, y) => x + y.part, 0)).toBeCloseTo(1);
    expect(a[1]).toEqual({ part: 0.75, debut: 0.25 });
    expect(arcsAnneau([0, 0]).every((x) => x.part === 0)).toBe(true);
  });
});
