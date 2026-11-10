import { describe, it, expect } from 'vitest';
import { trajectoireMois, bandeHistorique, etatMois, bilanHorsEchantillon } from './trajectoire';
import type { MonthlyReturn } from './compute';

describe('trajectoireMois', () => {
  it('rendement cumulé par rang de séance, depuis la dernière clôture du mois précédent', () => {
    const t = trajectoireMois(
      [
        { date: '2025-10-30', close: 90 },
        { date: '2025-10-31', close: 100 },
        { date: '2025-11-03', close: 102 },
        { date: '2025-11-04', close: 99 },
      ],
      2025, 11,
    );
    expect(t).toHaveLength(2);
    expect(t![0]).toMatchObject({ rang: 1 });
    expect(t![0]!.cumul).toBeCloseTo(0.02);
    expect(t![1]!.cumul).toBeCloseTo(-0.01);
  });

  it('réintègre le coupon à partir de la date de détachement', () => {
    const closes = [
      { date: '2025-04-30', close: 1000 },
      { date: '2025-05-15', close: 1000 },
      { date: '2025-05-16', close: 940 },
    ];
    const t = trajectoireMois(closes, 2025, 5, [{ date: '2025-05-16', montant: 63 }]);
    expect(t![0]!.cumul).toBeCloseTo(0);
    expect(t![1]!.cumul).toBeCloseTo(0.003);
  });

  it('null sans cours avant le mois', () => {
    expect(trajectoireMois([{ date: '2025-11-03', close: 100 }], 2025, 11)).toBeNull();
  });
});

describe('bandeHistorique', () => {
  it('médiane et quartiles par rang, effectif par rang', () => {
    const trajs = [1, 2, 3, 4, 5].map((k) => [{ rang: 1, cumul: k / 100 }, { rang: 2, cumul: k / 50 }]);
    trajs.push([{ rang: 1, cumul: 0.06 }]); // une année plus courte
    const b = bandeHistorique(trajs);
    expect(b[0]).toMatchObject({ rang: 1, n: 6 });
    expect(b[0]!.mediane).toBeCloseTo(0.035);
    expect(b[1]).toMatchObject({ rang: 2, n: 5 });
    expect(b[1]!.mediane).toBeCloseTo(0.06);
    expect(b[1]!.q25).toBeCloseTo(0.04);
    expect(b[1]!.q75).toBeCloseTo(0.08);
  });
});

describe('etatMois', () => {
  const bande = Array.from({ length: 20 }, (_, i) => ({ rang: i + 1, mediane: 0, q25: -0.02, q75: 0.03, n: 8 }));
  it('trop tôt avant la cinquième séance', () => {
    expect(etatMois({ rdtEnCours: 0.1, rangSeance: 4, bande }).etat).toBe('trop_tot');
  });
  it('au-dessus, dans la fourchette, en dessous', () => {
    expect(etatMois({ rdtEnCours: 0.05, rangSeance: 7, bande }).etat).toBe('au_dessus');
    expect(etatMois({ rdtEnCours: 0.01, rangSeance: 7, bande }).etat).toBe('dans_la_fourchette');
    expect(etatMois({ rdtEnCours: -0.03, rangSeance: 7, bande })).toMatchObject({ etat: 'en_dessous', q25: -0.02, q75: 0.03, n: 8 });
  });
  it('historique insuffisant sous 5 années au rang courant', () => {
    const courte = bande.map((b) => ({ ...b, n: 4 }));
    expect(etatMois({ rdtEnCours: 0, rangSeance: 7, bande: courte }).etat).toBe('historique_insuffisant');
  });
  it('rang au-delà de la bande : on prend le dernier rang connu', () => {
    expect(etatMois({ rdtEnCours: 0.05, rangSeance: 25, bande }).etat).toBe('au_dessus');
  });
});

describe('bilanHorsEchantillon', () => {
  const r = (year: number, month: number, ret: number): MonthlyReturn => ({ year, month, ret, gapMonths: 0 });
  it('compare le signe du profil des années précédentes au réalisé', () => {
    // Juin : hausse 2010-2015, puis 2016 en baisse, 2017 en hausse.
    const rets = [2010, 2011, 2012, 2013, 2014, 2015].map((y) => r(y, 6, 0.02)).concat([r(2016, 6, -0.01), r(2017, 6, 0.03)]);
    const b = bilanHorsEchantillon(rets, 10).find((m) => m.month === 6)!;
    // Tests possibles à partir de 2015 (5 années antérieures) : 2015 ✓, 2016 ✗, 2017 ✓.
    expect(b).toMatchObject({ tests: 3, verifies: 2 });
  });
  it('aucun test sans 5 années antérieures', () => {
    const b = bilanHorsEchantillon([r(2020, 1, 0.1), r(2021, 1, 0.1)], 10).find((m) => m.month === 1)!;
    expect(b).toMatchObject({ tests: 0, verifies: 0 });
  });
});
