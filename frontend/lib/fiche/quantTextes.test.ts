import { describe, it, expect } from 'vitest';
import { traduireNote, traduireRaison, chaineGardeFous, resumeGardeFous, raisonAffichable, penaliteRetiree, noteEcartArrondi } from './quantTextes';

describe('resumeGardeFous', () => {
  it('STAC : seule la pénalité de risque est retirée du score', () => {
    const c = chaineGardeFous([{ code: 'LIQ', points: 15 }, { code: 'VOL', points: 10 }, { code: 'RISK', points: 20 }], null);
    expect(resumeGardeFous(c)).toBe('Pénalité de risque −20 pts retirée du score (plafond 25) · liquidité et volatilité (−25 pts) déjà déduites du pilier Momentum');
  });
  it('sans garde-fou', () => {
    expect(resumeGardeFous(null)).toBeNull();
  });
  it('plafond atteint', () => {
    const c = chaineGardeFous([{ code: 'RISK', points: 30 }], null);
    expect(resumeGardeFous(c)).toBe('Pénalité de risque −25 pts retirée du score (plafond 25 atteint)');
  });
});

describe('traduireNote', () => {
  it.each([
    ['Bénéfice <=0: PER/EY neutralisés', 'Bénéfice négatif ou nul : PER et rendement des bénéfices neutralisés'],
    ['EQ sur 3 facteurs', 'Qualité des bénéfices calculée sur 3 facteurs'],
    ['ValueScore sur 2/5 facteurs', 'Valorisation calculée sur 2 facteurs sur 5'],
    ['Seulement 2/4 piliers disponibles', 'Seulement 2 piliers disponibles sur 4'],
    ['Momentum indisponible', 'Momentum indisponible'],
    ['Données insuffisantes (<3 facteurs momentum)', 'Données insuffisantes (moins de 3 facteurs de momentum)'],
    ['Coût du risque indisponible: poids réalloué', 'Coût du risque indisponible : poids réalloué'],
    ['Données prudentielles insuffisantes: score plafonné à 60', 'Données prudentielles insuffisantes : score plafonné à 60'],
    ['Payout >100%: dividende non soutenable', 'Taux de distribution supérieur à 100 % : dividende non soutenable'],
    ['Payout >80%: dividende pénalisé', 'Taux de distribution supérieur à 80 % : dividende pénalisé'],
  ])('%s', (brut, attendu) => expect(traduireNote(brut)).toBe(attendu));
  it('repli sur la chaîne brute pour un code inconnu', () => {
    expect(traduireNote('Quelque chose de neuf')).toBe('Quelque chose de neuf');
  });
});

describe('traduireRaison', () => {
  it('liquidité avec la date du calcul', () => {
    expect(traduireRaison({ code: 'LIQ', reason: 'LiquidityScore 46 → -15' }, '5 oct. 2026')).toBe('score de liquidité 46 (au 5 oct. 2026) : −15');
  });
  it('liquidité inconnue', () => {
    expect(traduireRaison({ code: 'LIQ', reason: 'LiquidityScore N/A → -15' }, null)).toBe('score de liquidité indisponible : −15');
  });
  it('volatilité', () => {
    expect(traduireRaison({ code: 'VOL', reason: 'Vol 0.68 rang 96% → -10' }, null)).toBe('volatilité 0,68, plus forte que 96 % des valeurs : −10');
  });
  it('pénalité de risque', () => {
    expect(traduireRaison({ code: 'RISK', reason: 'penalite risque' }, null)).toBe('pénalité de risque');
  });
  it('repli sur la raison brute', () => {
    expect(traduireRaison({ code: 'XYZ', reason: 'inédit' }, null)).toBe('inédit');
  });
});

describe('chaineGardeFous', () => {
  const p = [{ code: 'LIQ', points: 15 }, { code: 'VOL', points: 10 }, { code: 'RISK', points: 20 }];
  it('somme brute, plafond et pénalité appliquée', () => {
    const c = chaineGardeFous(p, { sommePonderee: 28.4, penalite: 20.4, score: 8 })!;
    expect(c.total).toBe(45);
    expect(c.points).toEqual([15, 10, 20]);
    expect(c.plafond).toBe(25);
    expect(c.risque).toBe(20);
    expect(c.risquePlafonne).toBe(false);
    expect(c.dansMomentum).toBe(25);
    expect(c.appliquee).toBeCloseTo(20.4, 6);
  });
  it('sans pénalité de risque global, rien à retirer de la somme pondérée', () => {
    const c = chaineGardeFous([{ code: 'LIQ', points: 15 }], { sommePonderee: 50, penalite: 0, score: 50 })!;
    expect(c.risque).toBe(0);
    expect(c.dansMomentum).toBe(15);
  });
  it('sans décomposition, pas de pénalité appliquée', () => {
    const c = chaineGardeFous([{ code: 'RISK', points: 25 }], null)!;
    expect(c.risquePlafonne).toBe(false);
    expect(c.appliquee).toBeNull();
  });
  it('aucun garde-fou : null', () => {
    expect(chaineGardeFous([], null)).toBeNull();
  });
});

describe('affichage de la pénalité de risque', () => {
  const dec = { sommePonderee: 28.4, penalite: 20.4 } as never;
  const c = chaineGardeFous([{ code: 'RISK', points: 20 }], dec)!;
  it('retire le sous-titre redondant', () => {
    expect(raisonAffichable({ code: 'RISK', reason: 'penalite risque' }, null)).toBeNull();
    expect(raisonAffichable({ code: 'VOL', reason: 'Vol 0.5 rang 80% → -5' }, null)).not.toBeNull();
  });
  it('pénalité retirée plafonnée, et note d\'arrondi', () => {
    expect(penaliteRetiree(c)).toBe(20);
    expect(noteEcartArrondi(c)).toBe('écart de 0,4 dû à l\'arrondi du score');
  });
  it('pas de note sans écart', () => {
    const c2 = chaineGardeFous([{ code: 'RISK', points: 20 }], { sommePonderee: 28, penalite: 20 } as never)!;
    expect(noteEcartArrondi(c2)).toBeNull();
  });
});
