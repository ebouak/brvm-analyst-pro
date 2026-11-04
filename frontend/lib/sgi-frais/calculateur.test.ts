import { describe, it, expect } from 'vitest';
import { calculerCoutSGI, calculerSeuilRentabilite, estSousDepotMinimum, BRVM_DCBR_PCT, baremeComplet, classerResultats, montantParOrdreParDefaut } from './calculateur';
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
    droitsGardeMinimum: null,
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

  it('le plancher de garde agit comme un minimum par période (remplace le taux proportionnel si plus élevé)', () => {
    const sgi = mkSgi({ droitsGardePctMax: 0.5, droitsGardeFrequence: 'trimestriel', droitsGardeMinimum: 2500 });
    // Petit montant : taux proportionnel par trimestre = 100 000 * 0,5% = 500, inférieur au plancher 2 500
    const r = calculerCoutSGI(sgi, { montant: 100_000, nbOrdres: 0, dureeAns: 1 });
    // plancher 2 500 × 4 trimestres × 1 an = 10 000 (pas 500 × 4 = 2 000)
    expect(r.coutGarde).toBeCloseTo(10_000, 6);
  });

  it('le plancher de garde ne s\'applique pas si le taux proportionnel est déjà plus élevé', () => {
    const sgi = mkSgi({ droitsGardePctMax: 0.5, droitsGardeFrequence: 'trimestriel', droitsGardeMinimum: 2500 });
    // Gros montant : taux proportionnel par trimestre = 10 000 000 * 0,5% = 50 000, supérieur au plancher 2 500
    const r = calculerCoutSGI(sgi, { montant: 10_000_000, nbOrdres: 0, dureeAns: 1 });
    expect(r.coutGarde).toBeCloseTo(200_000, 6); // 50 000 × 4 trimestres
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

describe('calculerSeuilRentabilite', () => {
  it('calcule le % de hausse nécessaire pour un aller-retour (achat + vente)', () => {
    const sgi = mkSgi({ courtagePctMax: 1.0 });
    const r = calculerSeuilRentabilite(sgi, 1_000_000);
    // 2 ordres × (1,0% courtage + 0,3% réglementaire) = 2,6%
    expect(r.seuilPct).toBeCloseTo(2.6, 6);
  });

  it('exclut la garde et la tenue de compte (aller-retour ponctuel, pas de détention)', () => {
    const sgi = mkSgi({ courtagePctMax: 1.0, droitsGardePctMax: 5.0, tenueCompteMontant: 100_000 });
    const r = calculerSeuilRentabilite(sgi, 1_000_000);
    expect(r.seuilPct).toBeCloseTo(2.6, 6); // inchangé malgré garde/tenue élevées
  });

  it('seuilPct = 0 quand montant = 0', () => {
    const sgi = mkSgi({ courtagePctMax: 1.0 });
    const r = calculerSeuilRentabilite(sgi, 0);
    expect(r.seuilPct).toBe(0);
  });
});

describe('estSousDepotMinimum', () => {
  it('vrai quand le montant est inférieur au dépôt minimum', () => {
    const sgi = mkSgi({ depotMinimum: 500_000 });
    expect(estSousDepotMinimum(sgi, 200_000)).toBe(true);
  });

  it('faux quand le montant est suffisant', () => {
    const sgi = mkSgi({ depotMinimum: 500_000 });
    expect(estSousDepotMinimum(sgi, 500_000)).toBe(false);
  });

  it('faux quand la SGI n’a pas de dépôt minimum renseigné (pas de fausse alerte)', () => {
    const sgi = mkSgi({ depotMinimum: null });
    expect(estSousDepotMinimum(sgi, 1000)).toBe(false);
  });
});

// Défaut constaté le 2026-11-04 : IFI facture 0,2 % sous 100 M FCFA par ordre,
// le moteur appliquait la borne haute (0,75 %) à tout le monde — un taux
// inconnu n'était pas en cause, le barème le fixe selon le montant.
describe('paliers par montant', () => {
  const IFI = mkSgi({
    courtagePctMin: 0.2,
    courtagePctMax: 0.75,
    courtagePaliers: [
      { jusqua: 100_000_000, pct: 0.2 },
      { jusqua: 500_000_000, pct: 0.75 },
      { jusqua: null, pct: 0.5 },
    ],
  });

  it('courtage : taux de la tranche du montant de l’ordre, pas la borne haute', () => {
    const r = calculerCoutSGI(IFI, { montant: 1_000_000, nbOrdres: 1, dureeAns: 0 });
    expect(r.coutCourtage).toBeCloseTo(2_000, 5); // 0,2 %
  });

  it('courtage : borne de tranche incluse, puis tranche suivante, puis dernière tranche ouverte', () => {
    expect(calculerCoutSGI(IFI, { montant: 100_000_000, nbOrdres: 1, dureeAns: 0 }).coutCourtage).toBeCloseTo(200_000, 3);
    expect(calculerCoutSGI(IFI, { montant: 200_000_000, nbOrdres: 1, dureeAns: 0 }).coutCourtage).toBeCloseTo(1_500_000, 3);
    expect(calculerCoutSGI(IFI, { montant: 600_000_000, nbOrdres: 1, dureeAns: 0 }).coutCourtage).toBeCloseTo(3_000_000, 3);
  });

  it('garde : taux de la tranche de la valeur du portefeuille', () => {
    const BOA = mkSgi({
      droitsGardePctMin: 0.22,
      droitsGardePctMax: 0.27,
      droitsGardeFrequence: 'annuel',
      gardePaliers: [{ jusqua: 10_000_000, pct: 0.27 }, { jusqua: null, pct: 0.22 }],
    });
    expect(calculerCoutSGI(BOA, { montant: 5_000_000, nbOrdres: 0, dureeAns: 1 }).coutGarde).toBeCloseTo(13_500, 3);
    expect(calculerCoutSGI(BOA, { montant: 20_000_000, nbOrdres: 0, dureeAns: 1 }).coutGarde).toBeCloseTo(44_000, 3);
  });

  it('sans palier, la borne haute reste la règle', () => {
    const r = calculerCoutSGI(mkSgi({ courtagePctMin: 0.2, courtagePctMax: 0.75 }), { montant: 1_000_000, nbOrdres: 1, dureeAns: 0 });
    expect(r.coutCourtage).toBeCloseTo(7_500, 5);
  });

  it('liste de paliers vide : repli sur la borne haute, jamais un taux nul', () => {
    const r = calculerCoutSGI(mkSgi({ courtagePctMax: 1, courtagePaliers: [] }), { montant: 1_000_000, nbOrdres: 1, dureeAns: 0 });
    expect(r.coutCourtage).toBeCloseTo(10_000, 5);
  });
});

// Modèle réaliste (2026-11-04) : chaque ordre portait sur tout le capital —
// 1 M FCFA et 4 achats + 4 ventes simulaient 8 M FCFA échangés dans l'année.
describe('montant par ordre', () => {
  const sgi = mkSgi({ courtagePctMax: 1, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel', tenueCompteMontant: 0 });

  it('courtage et frais BRVM portent sur le montant de l’ordre, la garde sur le capital', () => {
    const r = calculerCoutSGI(sgi, { montant: 1_000_000, montantParOrdre: 250_000, nbOrdres: 8, dureeAns: 1 });
    expect(r.coutCourtage).toBeCloseTo(20_000, 5); // 8 × 250 000 × 1 %
    expect(r.coutReglementaire).toBeCloseTo(6_000, 5); // 8 × 250 000 × 0,3 %
    expect(r.coutGarde).toBeCloseTo(5_000, 5); // 1 000 000 × 0,5 %
  });

  it('sans montant par ordre, chaque ordre porte sur le montant investi (comportement antérieur)', () => {
    const r = calculerCoutSGI(sgi, { montant: 1_000_000, nbOrdres: 2, dureeAns: 1 });
    expect(r.coutCourtage).toBeCloseTo(20_000, 5);
  });

  it('le minimum de perception joue sur chaque ordre, d’après son montant', () => {
    const r = calculerCoutSGI(mkSgi({ courtagePctMax: 0.8, minimumPerception: 1_000 }), { montant: 1_000_000, montantParOrdre: 50_000, nbOrdres: 3, dureeAns: 0 });
    expect(r.coutCourtage).toBeCloseTo(3_000, 5); // 0,8 % × 50 000 = 400 < 1 000
  });

  it('la tranche de courtage se lit sur le montant de l’ordre', () => {
    const ifi = mkSgi({ courtagePctMax: 0.75, courtagePaliers: [{ jusqua: 100_000_000, pct: 0.2 }, { jusqua: null, pct: 0.75 }] });
    const r = calculerCoutSGI(ifi, { montant: 1_000_000_000, montantParOrdre: 50_000_000, nbOrdres: 1, dureeAns: 0 });
    expect(r.coutCourtage).toBeCloseTo(100_000, 3); // 0,2 % de 50 M
  });

  it('montant par ordre par défaut : capital réparti sur les achats', () => {
    expect(montantParOrdreParDefaut(1_000_000, 4)).toBe(250_000);
    expect(montantParOrdreParDefaut(1_000_000, 0)).toBe(1_000_000);
  });
});

// Défaut constaté le 2026-11-04 : un frais absent comptait 0 et faisait passer
// la SGI devant des barèmes complets (BOA 5e pour un petit porteur).
describe('barèmes incomplets', () => {
  const complet = mkSgi({ sgiNom: 'Complète', courtagePctMax: 1, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel', tenueCompteMontant: 5_000, tenueCompteFrequence: 'annuel' });
  const sansTenue = mkSgi({ sgiNom: 'Sans tenue', courtagePctMax: 1, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel' });

  it('un frais de virement non publié ne rend pas un barème incomplet', () => {
    expect(baremeComplet(calculerCoutSGI(complet, { montant: 1_000_000, nbOrdres: 1, dureeAns: 1 }))).toBe(true);
  });

  it('courtage, garde ou tenue absent rend le barème incomplet', () => {
    expect(baremeComplet(calculerCoutSGI(sansTenue, { montant: 1_000_000, nbOrdres: 1, dureeAns: 1 }))).toBe(false);
  });

  it('les barèmes complets passent devant, même plus chers', () => {
    const input = { montant: 1_000_000, nbOrdres: 1, dureeAns: 1 };
    const classes = classerResultats([calculerCoutSGI(sansTenue, input), calculerCoutSGI(complet, input)]);
    expect(classes.map((r) => r.sgiNom)).toEqual(['Complète', 'Sans tenue']);
  });
});
