import { describe, expect, it } from 'vitest';
import {
  PARITE_EUR_FCFA,
  SaisieInvalide,
  calculerBanque,
  calculerChange,
  calculerDistribution,
  calculerDps,
  calculerFrais,
  calculerObligation,
  calculerOpcvm,
  calculerPbRoe,
  calculerPer,
  calculerPosition,
  calculerRendementNet,
  calculerRendementTotal,
  calculerSouscription,
  calculerValeurFuture,
  zonePer,
} from './simulateurs';

/** Aucune lecture ne doit ressembler à un ordre d'achat ou de vente. */
const SANS_CONSEIL = /\b(achetez|vendez|conservez|à acheter|à vendre|recommand)/i;
const espaces = (s: string) => s.replace(/[  ]/g, ' ');

describe('frais d’un ordre', () => {
  it('reprend l’exemple de la leçon 9 : 20 × 10 000 + 1 % = 202 000 FCFA', () => {
    const r = calculerFrais({ cours: 10_000, quantite: 20, taux_frais_pct: 1, minimum_fcfa: 0 });
    expect(r.coutTotal).toBe(202_000);
    expect(r.fraisPct).toBeCloseTo(1);
    // Revente avec 1 % : P·20·0,99 = 202 000 → P ≈ 10 202
    expect(r.prixSansPerte).toBeCloseTo(202_000 / (20 * 0.99), 6);
    expect(r.hausseNecessairePct).toBeCloseTo(2.0202, 3);
    expect(r.alertes).toEqual([]);
    expect(r.lecture).not.toMatch(SANS_CONSEIL);
  });
  it('signale un minimum de frais qui écrase un petit ordre', () => {
    const r = calculerFrais({ cours: 2_500, quantite: 2, taux_frais_pct: 1, minimum_fcfa: 1_000 });
    expect(r.minimumApplique).toBe(true);
    expect(r.frais).toBe(1_000);
    expect(r.fraisPct).toBeCloseTo(20);
    // Revente : le minimum s'applique encore → (6 000 + 1 000) / 2
    expect(r.prixSansPerte).toBe(3_500);
    expect(r.alertes.length).toBeGreaterThan(0);
  });
  it('refuse une quantité fractionnaire', () => {
    expect(() => calculerFrais({ cours: 1000, quantite: 1.5, taux_frais_pct: 1, minimum_fcfa: 0 })).toThrow(SaisieInvalide);
  });
});

describe('rendement total', () => {
  it('reprend l’exemple de la leçon 4 : (80 000 + 120 000) ÷ 1 000 000 = 20 %', () => {
    const r = calculerRendementTotal({ prix_achat: 5_000, prix_vente: 5_600, actions: 200, dividendes_par_action: 400, annees: 1 });
    expect(r.investi).toBe(1_000_000);
    expect(r.dividendes).toBe(80_000);
    expect(r.plusValue).toBe(120_000);
    expect(r.rendementTotalPct).toBeCloseTo(20);
    expect(r.rendementSansDividendePct).toBeCloseTo(12);
  });
  it('reprend l’exemple de la leçon 11 : 10 %', () => {
    const r = calculerRendementTotal({ prix_achat: 10_000, prix_vente: 10_600, actions: 1, dividendes_par_action: 400, annees: 1 });
    expect(r.rendementTotalPct).toBeCloseTo(10);
  });
  it('annualise sur plusieurs années et dit quand le dividende amortit une baisse', () => {
    const r = calculerRendementTotal({ prix_achat: 1_000, prix_vente: 900, actions: 10, dividendes_par_action: 150, annees: 2 });
    expect(r.rendementTotalPct).toBeCloseTo(5);
    expect(r.rendementAnnuelPct).toBeCloseTo((1.05 ** 0.5 - 1) * 100, 6);
    expect(r.lecture).toMatch(/compensent la baisse/);
  });
  it('met en garde contre un rendement annuel exceptionnel', () => {
    const r = calculerRendementTotal({ prix_achat: 1_000, prix_vente: 2_000, actions: 1, dividendes_par_action: 0, annees: 1 });
    expect(r.alertes.length).toBe(1);
  });
});

describe('valeur future', () => {
  it('capital seul : 1 000 × 1,10^10 ≈ 2 594 FCFA (leçon 7)', () => {
    const r = calculerValeurFuture({ capital_initial: 1_000, versement_mensuel: 0, taux_pct: 10, annees: 10, objectif: 0 });
    expect(Math.round(r.valeurFinale)).toBe(2_594);
    expect(r.totalVerse).toBe(1_000);
    expect(r.valeurSiRetard3Ans).toBeCloseTo(1_000 * 1.1 ** 7, 6);
    expect(r.points).toHaveLength(11);
  });
  it('calcule le versement qui atteint l’objectif', () => {
    const r = calculerValeurFuture({ capital_initial: 200_000, versement_mensuel: 0, taux_pct: 8, annees: 10, objectif: 5_000_000 });
    const verif = calculerValeurFuture({ capital_initial: 200_000, versement_mensuel: r.versementPourObjectif!, taux_pct: 8, annees: 10, objectif: 0 });
    expect(verif.valeurFinale).toBeGreaterThanOrEqual(5_000_000);
    const moinsUn = calculerValeurFuture({ capital_initial: 200_000, versement_mensuel: r.versementPourObjectif! - 1, taux_pct: 8, annees: 10, objectif: 0 });
    expect(moinsUn.valeurFinale).toBeLessThan(5_000_000);
  });
  it('rendement nul : la valeur égale les versements', () => {
    const r = calculerValeurFuture({ capital_initial: 0, versement_mensuel: 10_000, taux_pct: 0, annees: 2, objectif: 0 });
    expect(r.valeurFinale).toBe(240_000);
    expect(r.gains).toBe(0);
  });
  it('met en garde au-delà des hypothèses de la leçon', () => {
    expect(calculerValeurFuture({ capital_initial: 1, versement_mensuel: 0, taux_pct: 15, annees: 5, objectif: 0 }).alertes).toHaveLength(1);
  });
});

describe('PER', () => {
  it('reprend la leçon PER : 3 000 ÷ 200 = 15, rendement bénéficiaire 6,7 %', () => {
    const r = calculerPer({ cours: 3_000, bpa: 200, croissance_pct: 0, annees: 3 });
    expect(r.per).toBe(15);
    expect(r.rendementBeneficiairePct).toBeCloseTo(6.667, 2);
    expect(r.zone).toBe('intermediaire');
  });
  it('un bénéfice qui double ramène un PER de 20 à 10 (leçon PER, section 2)', () => {
    const r = calculerPer({ cours: 4_000, bpa: 200, croissance_pct: (2 ** (1 / 3) - 1) * 100, annees: 3 });
    expect(r.per).toBe(20);
    expect(r.perFutur).toBeCloseTo(10, 6);
  });
  it('repères de zone', () => {
    expect(zonePer(7.9)).toBe('faible');
    expect(zonePer(8)).toBe('intermediaire');
    expect(zonePer(18)).toBe('entre');
    expect(zonePer(25)).toBe('eleve');
  });
  it('bénéfice nul : pas de PER', () => {
    const r = calculerPer({ cours: 1_000, bpa: 0, croissance_pct: 0, annees: 3 });
    expect(r.per).toBeNull();
    expect(r.lecture).toMatch(/pas de sens/);
  });
});

describe('P/B = PER × ROE', () => {
  it('reprend le tableau de la leçon : A 12 × 25 % = 3 ; B 12 × 6 % = 0,72', () => {
    const [a, b] = calculerPbRoe([{ nom: 'A', per: 12, roe_pct: 25 }, { nom: 'B', per: 12, roe_pct: 6 }]);
    expect(a!.pb).toBeCloseTo(3);
    expect(b!.pb).toBeCloseTo(0.72);
    expect(a!.lecture).toMatch(/justifie/);
    expect(b!.lecture).toMatch(/rentabilité faible/);
  });
});

describe('banque', () => {
  it('coefficient d’exploitation 40 ÷ 100 = 40 %, coût du risque doublé', () => {
    const r = calculerBanque({ pnb: 100, frais_generaux: 40, cout_risque: 10 });
    expect(r.coefficientPct).toBe(40);
    expect(r.resultatBrutExploitation).toBe(60);
    expect(r.resultatAvantImpot).toBe(50);
    expect(r.partRisquePct).toBeCloseTo(16.667, 2);
    expect(r.resultatSiRisqueDouble).toBe(40);
  });
  it('frais supérieurs au produit : alerte', () => {
    expect(calculerBanque({ pnb: 100, frais_generaux: 120, cout_risque: 0 }).alertes.length).toBeGreaterThan(0);
  });
});

describe('DPS', () => {
  it('reprend la leçon : (6 000 − 4 500) ÷ 5 = 300, cours théorique 5 700', () => {
    const r = calculerDps({ cours: 6_000, prix_emission: 4_500, parite: 4, actions: 100 });
    expect(r.valeurDroit).toBe(300);
    expect(r.coursTheorique).toBe(5_700);
    expect(r.nouvellesPossibles).toBe(25);
    expect(r.coutSouscription).toBe(112_500);
    expect(r.valeurDroits).toBe(30_000);
    expect(r.partConserveePct).toBe(80);
    // La valeur se conserve : action après détachement + droit = action avant.
    expect(r.coursTheorique + r.valeurDroit).toBe(6_000);
  });
  it('prix d’émission au-dessus du cours : droit sans valeur, alerte', () => {
    const r = calculerDps({ cours: 4_000, prix_emission: 4_500, parite: 4, actions: 10 });
    expect(r.valeurDroit).toBe(0);
    expect(r.alertes.length).toBeGreaterThan(0);
  });
});

describe('rendement net d’IRVM', () => {
  it('reprend la leçon fiscalité : 1 000 brut à 12 % → 880 net, 5,5 % sur 16 000', () => {
    const r = calculerRendementNet({ dividende_brut: 1_000, cours: 16_000, pays: 'CI' });
    expect(r.choisie.net).toBe(880);
    expect(r.choisie.rendementNetPct).toBeCloseTo(5.5);
    expect(r.choisie.netEuros).toBeCloseTo(880 / PARITE_EUR_FCFA, 6);
  });
  it('un pays non vérifié n’a aucun montant net', () => {
    const r = calculerRendementNet({ dividende_brut: 1_000, cours: 16_000, pays: 'NE' });
    expect(r.choisie.net).toBeNull();
    expect(r.lecture).toMatch(/pas vérifié/);
    expect(r.lignes).toHaveLength(8);
  });
});

describe('obligation', () => {
  it('reprend la leçon : coupon 650, rendement courant 6,6 % à 9 800', () => {
    const r = calculerObligation({ nominal: 10_000, taux_nominal_pct: 6.5, prix: 9_800, annees_restantes: 5, jours_ecoules: 0, taux_marche_pct: 7 });
    expect(r.coupon).toBe(650);
    expect(r.rendementCourantPct).toBeCloseTo(6.633, 2);
    // Sous le nominal : actuariel > courant
    expect(r.rendementActuarielPct!).toBeGreaterThan(r.rendementCourantPct);
    // Taux de marché > coupon : prix théorique sous le nominal
    expect(r.prixAuTauxMarche).toBeLessThan(10_000);
  });
  it('au pair, le rendement actuariel égale le taux nominal', () => {
    const r = calculerObligation({ nominal: 10_000, taux_nominal_pct: 6, prix: 10_000, annees_restantes: 5, jours_ecoules: 73, taux_marche_pct: 6 });
    expect(r.rendementActuarielPct!).toBeCloseTo(6, 2);
    expect(r.couponCouru).toBeCloseTo(120);
    expect(r.prixAuTauxMarche).toBeCloseTo(10_000, 4);
  });
});

describe('frais d’OPCVM', () => {
  it('reprend la leçon : 1 000 000 sur 5 ans, 2 % d’entrée, 1,5 % de gestion', () => {
    const r = calculerOpcvm({ montant: 1_000_000, annees: 5, frais_entree_pct: 2, frais_gestion_pct: 1.5, frais_sortie_pct: 0, performance_pct: 0 });
    expect(r.points[0]!.avecFrais).toBe(980_000);
    expect(r.valeurFinale).toBeCloseTo(980_000 * 0.985 ** 5, 6);
    expect(r.totalFrais).toBeCloseTo(1_000_000 - 980_000 * 0.985 ** 5, 6);
    // Performance qui compense : (1/0,98)^(1/5) / 0,985 − 1
    expect(r.performancePourCompenserPct).toBeCloseTo((((1 / 0.98) ** 0.2) / 0.985 - 1) * 100, 6);
    const v = calculerOpcvm({ montant: 1_000_000, annees: 5, frais_entree_pct: 2, frais_gestion_pct: 1.5, frais_sortie_pct: 0, performance_pct: r.performancePourCompenserPct });
    expect(v.valeurFinale).toBeCloseTo(1_000_000, 4);
  });
});

describe('taille de position', () => {
  it('reprend la leçon : 5 000 000, 1 %, achat 2 000, stop 1 800 → 250 actions', () => {
    const r = calculerPosition({ portefeuille: 5_000_000, risque_pct: 1, prix_achat: 2_000, stop: 1_800, objectif: 2_500 });
    expect(r.risqueMax).toBe(50_000);
    expect(r.risqueParAction).toBe(200);
    expect(r.actions).toBe(250);
    expect(r.investi).toBe(500_000);
    expect(r.partPortefeuillePct).toBe(10);
    expect(r.rapportGainRisque).toBe(2.5);
    expect(r.tauxReussiteNecessairePct).toBeCloseTo(28.571, 2);
    expect(r.alertes).toEqual([]);
  });
  it('plafonne au capital un stop trop proche', () => {
    const r = calculerPosition({ portefeuille: 100_000, risque_pct: 1, prix_achat: 1_000, stop: 999, objectif: 0 });
    expect(r.plafonneParCapital).toBe(true);
    expect(r.actions).toBe(100);
  });
  it('refuse un stop au-dessus du prix', () => {
    expect(() => calculerPosition({ portefeuille: 1, risque_pct: 1, prix_achat: 100, stop: 120, objectif: 0 })).toThrow(SaisieInvalide);
  });
});

describe('souscription à une introduction', () => {
  it('BBGC : 142 % souscrit → chaque ordre servi à environ 70,4 %', () => {
    const r = calculerSouscription({ titres_offerts: 10_000_000, prix: 6_750, taux_souscription_pct: 142, demande: 100 });
    expect(r.coefficientServicePct).toBeCloseTo(70.42, 2);
    expect(r.titresServis).toBe(70);
    expect(r.montantPaye).toBe(472_500);
    expect(r.montantRendu).toBe(202_500);
    expect(r.titresDemandesTotal).toBe(14_200_000);
  });
  it('offre non sursouscrite : servi en entier', () => {
    expect(calculerSouscription({ titres_offerts: 1_000, prix: 10, taux_souscription_pct: 80, demande: 7 }).titresServis).toBe(7);
  });
});

describe('affectation du résultat', () => {
  it('2 Md ÷ 10 M = 200 de BPA ; 60 % distribués → 120 par action', () => {
    const r = calculerDistribution({ resultat_net: 2_000_000_000, actions: 10_000_000, taux_distribution_pct: 60 });
    expect(r.bpa).toBe(200);
    expect(r.dpa).toBe(120);
    expect(r.misEnReserve).toBe(800_000_000);
  });
  it('plus de 100 % : puise dans les réserves', () => {
    const r = calculerDistribution({ resultat_net: 100, actions: 10, taux_distribution_pct: 120 });
    expect(r.misEnReserve).toBe(-20);
    expect(r.alertes.length).toBe(1);
  });
});

describe('change euro – franc CFA', () => {
  it('500 € × 655,957 ≈ 327 979 FCFA (leçon 10)', () => {
    const r = calculerChange({ montant_eur: 500, frais_pct: 0, frais_fixes_eur: 0, cours_action: 0 });
    expect(Math.round(r.fcfa)).toBe(327_979);
    expect(r.actions).toBeNull();
  });
  it('frais fixes sur un petit envoi : alerte', () => {
    const r = calculerChange({ montant_eur: 100, frais_pct: 1, frais_fixes_eur: 5, cours_action: 10_000 });
    expect(r.fraisEur).toBe(6);
    expect(r.actions).toBe(Math.floor((94 * PARITE_EUR_FCFA) / 10_000));
    expect(r.alertes.length).toBe(1);
  });
});

describe('aucune lecture n’est un conseil', () => {
  it('pour chaque simulateur', () => {
    const lectures = [
      calculerFrais({ cours: 10_000, quantite: 20, taux_frais_pct: 1, minimum_fcfa: 0 }).lecture,
      calculerRendementTotal({ prix_achat: 5_000, prix_vente: 5_600, actions: 200, dividendes_par_action: 400, annees: 1 }).lecture,
      calculerPer({ cours: 3_000, bpa: 200, croissance_pct: 10, annees: 3 }).lecture,
      calculerDps({ cours: 6_000, prix_emission: 4_500, parite: 4, actions: 100 }).lecture,
      calculerPosition({ portefeuille: 5_000_000, risque_pct: 1, prix_achat: 2_000, stop: 1_800, objectif: 2_500 }).lecture,
      calculerSouscription({ titres_offerts: 10_000_000, prix: 6_750, taux_souscription_pct: 142, demande: 100 }).lecture,
    ];
    for (const l of lectures) expect(espaces(l)).not.toMatch(SANS_CONSEIL);
  });
});
