import { describe, it, expect } from 'vitest';
import { calculerCoutSGI, BRVM_DCBR_PCT } from './calculateur';
import type { SgiFrais } from './types';

function mkSgi(partial: Partial<SgiFrais>): SgiFrais {
  return {
    sgiNom: 'Test SGI',
    courtagePctMin: null,
    courtagePctMax: null,
    minimumPerception: null,
    droitsGardePctMin: null,
    droitsGardePctMax: null,
    droitsGardeFrequence: null,
    tenueCompteMontant: null,
    tenueCompteFrequence: null,
    fraisVirement: null,
    depotMinimum: null,
    gestionSousMandatPctMin: null,
    gestionSousMandatPctMax: null,
    confiance: 'agrege_public',
    sourceUrl: null,
    sourceLabel: null,
    verifieLe: null,
    notes: null,
    ...partial,
  };
}

describe('BRVM_DCBR_PCT', () => {
  it('vaut 0,3% (0,2% BRVM + 0,1% DC/BR), conforme à brvm.org/fr/node/312', () => {
    expect(BRVM_DCBR_PCT).toBe(0.3);
  });
});

describe('calculerCoutSGI', () => {
  it('applique les frais réglementaires BRVM/DC-BR même si tout le reste est vide', () => {
    const sgi = mkSgi({});
    const r = calculerCoutSGI(sgi, { montant: 1_000_000, nbOrdres: 2, dureeAns: 1 });
    // 1 000 000 * 0,3% * 2 ordres = 6 000
    expect(r.coutReglementaire).toBeCloseTo(6000, 6);
    expect(r.total).toBeCloseTo(6000, 6); // tout le reste est 0 (champs manquants)
  });

  it('signale tous les champs manquants sans les ignorer silencieusement', () => {
    const sgi = mkSgi({});
    const r = calculerCoutSGI(sgi, { montant: 1_000_000, nbOrdres: 2, dureeAns: 1 });
    expect(r.champsManquants).toEqual(
      expect.arrayContaining(['courtage', 'droits_garde', 'tenue_compte', 'frais_virement']),
    );
  });

  it('utilise la borne MAX du courtage quand une fourchette existe (principe de prudence)', () => {
    const sgi = mkSgi({ courtagePctMin: 0.5, courtagePctMax: 1.0 });
    const r = calculerCoutSGI(sgi, { montant: 1_000_000, nbOrdres: 1, dureeAns: 1 });
    // courtage = 1 000 000 * 1,0% = 10 000 (pas 0,5%)
    expect(r.coutCourtage).toBeCloseTo(10_000, 6);
    expect(r.champsManquants).not.toContain('courtage');
  });

  it('le minimum de perception agit comme un plancher (remplace le courtage si plus élevé)', () => {
    const sgi = mkSgi({ courtagePctMax: 0.5, minimumPerception: 10_000 });
    // courtage proportionnel = 200 000 * 0,5% = 1 000, inférieur au plancher 10 000
    const r = calculerCoutSGI(sgi, { montant: 200_000, nbOrdres: 1, dureeAns: 1 });
    expect(r.coutCourtage).toBeCloseTo(10_000, 6);
  });

  it('applique le multiplicateur de fréquence trimestriel (×4) aux droits de garde', () => {
    const sgi = mkSgi({ droitsGardePctMax: 0.5, droitsGardeFrequence: 'trimestriel' });
    const r = calculerCoutSGI(sgi, { montant: 1_000_000, nbOrdres: 0, dureeAns: 1 });
    // 1 000 000 * 0,5% * 4 * 1 an = 20 000
    expect(r.coutGarde).toBeCloseTo(20_000, 6);
  });

  it('multiplie les coûts de garde et tenue par la durée de détention', () => {
    const sgi = mkSgi({ droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel', tenueCompteMontant: 5000, tenueCompteFrequence: 'annuel' });
    const r = calculerCoutSGI(sgi, { montant: 1_000_000, nbOrdres: 0, dureeAns: 3 });
    expect(r.coutGarde).toBeCloseTo(1_000_000 * 0.005 * 3, 6);
    expect(r.coutTenue).toBeCloseTo(5000 * 3, 6);
  });

  it('pctCapital = 0 quand montant = 0 (pas de division par zéro)', () => {
    const sgi = mkSgi({ courtagePctMax: 1 });
    const r = calculerCoutSGI(sgi, { montant: 0, nbOrdres: 1, dureeAns: 1 });
    expect(r.pctCapital).toBe(0);
  });
});
