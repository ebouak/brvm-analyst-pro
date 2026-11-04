import { describe, it, expect } from 'vitest';
import type { Sgi } from './directory';
import type { SgiFrais } from './types';
import { FILTRES_DEFAUT, courtagePublieMax, entreesAnnuaire, filtresActifs, filtrerAnnuaire, seuilsCourtage, trierAnnuaire } from './annuaire';
import { SCENARIO_DEFAUT } from './scenario';

const sgi = (nom: string, pays: string, type: Sgi['type'] = 'Indépendante'): Sgi => ({
  nom,
  pays,
  type,
  groupe: 'Non renseigné',
  depotMin: 'Non renseigné',
  depotMinSource: 'inconnu',
});

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

const directory = [sgi('Alpha', 'SN', 'Banque'), sgi('Beta', 'CI'), sgi('Gamma', 'CI'), sgi('Delta', 'BJ')];
const baremes = [
  frais('Alpha', { courtagePctMax: 0.8, notes: 'Bourse en ligne gratuite' }),
  frais('Beta', { courtagePctMax: 1, confiance: 'agrege_public' }),
  // Garde inconnue : barème incomplet, coût sous-estimé.
  frais('Gamma', { courtagePctMax: 0.5, droitsGardePctMax: null }),
];
const entrees = entreesAnnuaire(directory, baremes, SCENARIO_DEFAUT);

describe('annuaire des SGI', () => {
  it('une SGI sans barème n’a pas de coût, jamais un coût nul', () => {
    const delta = entrees.find((e) => e.sgi.nom === 'Delta')!;
    expect(delta.cout).toBeNull();
    expect(delta.complet).toBe(false);
  });

  it('les filtres se combinent', () => {
    const r = filtrerAnnuaire(entrees, { ...FILTRES_DEFAUT, pays: 'CI', bareme: 'homologue' });
    expect(r.map((e) => e.sgi.nom)).toEqual(['Gamma']);
    expect(filtrerAnnuaire(entrees, { ...FILTRES_DEFAUT, bareme: 'aucun' }).map((e) => e.sgi.nom)).toEqual(['Delta']);
    expect(filtrerAnnuaire(entrees, { ...FILTRES_DEFAUT, type: 'Banque', bourseEnLigne: true }).map((e) => e.sgi.nom)).toEqual(['Alpha']);
  });

  it('le filtre de courtage exclut un taux inconnu au lieu de le supposer bas', () => {
    const r = filtrerAnnuaire(entrees, { ...FILTRES_DEFAUT, courtageMax: 0.8 });
    expect(r.map((e) => e.sgi.nom).sort()).toEqual(['Alpha', 'Gamma']);
  });

  it('tri par coût : barèmes complets d’abord, incomplets ensuite, inconnus en dernier', () => {
    const r = trierAnnuaire(entrees, 'cout').map((e) => e.sgi.nom);
    expect(r.slice(2)).toEqual(['Gamma', 'Delta']);
    expect(r.slice(0, 2).sort()).toEqual(['Alpha', 'Beta']);
  });

  it('les seuils de courtage viennent des taux publiés, sans le maximum (qui retiendrait tout le monde)', () => {
    expect(seuilsCourtage(entrees)).toEqual([0.5, 0.8]);
    expect(seuilsCourtage([])).toEqual([]);
  });

  it('le courtage par tranche retient le taux le plus élevé', () => {
    expect(courtagePublieMax(frais('X', { courtagePctMax: null, courtagePaliers: [{ jusqua: 1e6, pct: 1 }, { jusqua: null, pct: 0.6 }] }))).toBe(1);
    expect(filtresActifs({ ...FILTRES_DEFAUT, pays: 'SN', bourseEnLigne: true })).toBe(2);
  });
});
