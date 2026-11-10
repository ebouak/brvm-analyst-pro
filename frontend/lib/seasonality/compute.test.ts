import { describe, it, expect } from 'vitest';
import {
  monthlyReturnsFromPrices,
  aggregateSeasonality,
  verdictCellule,
  marketMonthlyReturns,
  type MonthlyReturn,
} from './compute';

const ASOF = new Date('2026-11-10T00:00:00Z');

describe('monthlyReturnsFromPrices', () => {
  it('calcule le rendement mois-sur-mois (dernier close du mois)', () => {
    const prices = [
      { date: '2025-01-10', close: 100 },
      { date: '2025-01-31', close: 110 },
      { date: '2025-02-15', close: 120 },
      { date: '2025-02-28', close: 121 },
    ];
    const r = monthlyReturnsFromPrices(prices, { asOf: ASOF });
    expect(r).toEqual([{ year: 2025, month: 2, ret: 121 / 110 - 1, gapMonths: 0 }]);
  });

  it('signale un rendement qui enjambe un mois sans échange (gapMonths)', () => {
    const prices = [
      { date: '2025-01-31', close: 100 },
      { date: '2025-03-31', close: 120 },
      { date: '2025-04-30', close: 126 },
    ];
    const r = monthlyReturnsFromPrices(prices, { asOf: ASOF });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ year: 2025, month: 3, gapMonths: 1 });
    expect(r[1]).toMatchObject({ year: 2025, month: 4, gapMonths: 0 });
  });

  it('compte les mois sautés à cheval sur deux années', () => {
    const r = monthlyReturnsFromPrices(
      [{ date: '2024-11-29', close: 100 }, { date: '2025-02-28', close: 90 }],
      { asOf: ASOF },
    );
    expect(r[0]).toMatchObject({ year: 2025, month: 2, gapMonths: 2 });
  });

  it('exclut le mois en cours, inachevé', () => {
    const prices = [
      { date: '2026-09-30', close: 100 },
      { date: '2026-10-30', close: 110 },
      { date: '2026-11-09', close: 99 }, // 7 séances de novembre : pas un « novembre »
    ];
    const r = monthlyReturnsFromPrices(prices, { asOf: ASOF });
    expect(r).toEqual([{ year: 2026, month: 10, ret: 110 / 100 - 1, gapMonths: 0 }]);
  });

  it('renvoie [] si moins de 2 mois cotés', () => {
    expect(monthlyReturnsFromPrices([{ date: '2025-01-31', close: 100 }], { asOf: ASOF })).toEqual([]);
  });
});

/** Fabrique une cellule : un rendement par année à partir de 2010. */
const cellule = (rets: number[]) => rets.map((ret, i) => ({ year: 2010 + i, ret }));

describe('verdictCellule', () => {
  it('établi : 12 années, hausse régulière dans les deux moitiés', () => {
    const v = verdictCellule(cellule([0.04, 0.05, 0.03, 0.06, 0.04, 0.05, 0.03, 0.04, 0.06, 0.05, -0.01, 0.04]));
    expect(v).toBe('etabli');
  });

  it('hasard : moyenne positive et médiane négative', () => {
    // Un seul mois à +60 % tire la moyenne ; la médiane est négative.
    const v = verdictCellule(cellule([-0.02, -0.01, -0.03, 0.6, -0.02, -0.01, -0.02, 0.01, -0.03, -0.01]));
    expect(v).toBe('hasard');
  });

  it('hasard : moins de 5 observations, quelle que soit leur régularité', () => {
    expect(verdictCellule(cellule([0.05, 0.05, 0.06, 0.04]))).toBe('hasard');
  });

  it('indicatif : 6 années régulières, trop peu pour « établi »', () => {
    expect(verdictCellule(cellule([0.04, 0.05, 0.03, 0.06, 0.04, 0.05]))).toBe('indicatif');
  });

  it('hasard : rendements tous nuls', () => {
    expect(verdictCellule(cellule(Array(12).fill(0)))).toBe('hasard');
  });
});

describe('verdictCellule sur du bruit', () => {
  // Générateur déterministe (mulberry32) + Box-Muller : le test ne dépend pas du hasard.
  function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  it('une série aléatoire de 15 ans ne produit presque jamais de cellule « établie »', () => {
    const u = rng(20261110);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
    const TIRAGES = 1000;
    let cellulesEtablies = 0;
    let tiragesTouches = 0;
    for (let t = 0; t < TIRAGES; t++) {
      let dansCeTirage = 0;
      for (let m = 0; m < 12; m++) {
        const xs = Array.from({ length: 15 }, (_, i) => ({ year: 2011 + i, ret: gauss() * 0.08 }));
        if (verdictCellule(xs) === 'etabli') dansCeTirage++;
      }
      cellulesEtablies += dansCeTirage;
      if (dansCeTirage > 0) tiragesTouches++;
    }
    // Seuil corrigé pour 12 mois : au plus ~5 % des matrices portent une fausse
    // cellule « établie », soit moins de 0,5 % des cellules.
    expect(tiragesTouches / TIRAGES).toBeLessThanOrEqual(0.06);
    expect(cellulesEtablies / (TIRAGES * 12)).toBeLessThanOrEqual(0.005);
  });
});

describe('aggregateSeasonality', () => {
  const returns: MonthlyReturn[] = [
    { year: 2020, month: 1, ret: 0.10, gapMonths: 0 },
    { year: 2021, month: 1, ret: -0.10, gapMonths: 0 },
    { year: 2022, month: 1, ret: 0.20, gapMonths: 0 },
    { year: 2023, month: 1, ret: 0.0, gapMonths: 0 },
    { year: 2024, month: 1, ret: 0.05, gapMonths: 0 },
    { year: 2025, month: 1, ret: -0.05, gapMonths: 0 },
  ];
  const now = new Date('2025-01-15T00:00:00Z');

  it('agrège médiane, moyenne, part de hausses et n pour un mois', () => {
    const r = aggregateSeasonality(returns, 10, now);
    const jan = r.matrix.find((m) => m.month === 1)!;
    expect(jan.n).toBe(6);
    expect(jan.avgReturn).toBeCloseTo(0.2 / 6);
    expect(jan.medianReturn).toBeCloseTo(0.025);
    expect(jan.bullPct).toBeCloseTo(50);
    expect(jan.verdict).toBe('hasard');
  });

  it("écart-type d'échantillon (n − 1), null quand n < 3", () => {
    const r = aggregateSeasonality(
      [
        { year: 2023, month: 3, ret: 0.1, gapMonths: 0 },
        { year: 2024, month: 3, ret: 0.2, gapMonths: 0 },
        { year: 2025, month: 3, ret: 0.3, gapMonths: 0 },
        { year: 2024, month: 4, ret: 0.1, gapMonths: 0 },
        { year: 2025, month: 4, ret: 0.2, gapMonths: 0 },
      ],
      10, now,
    );
    expect(r.matrix.find((m) => m.month === 3)!.volatility).toBeCloseTo(0.1);
    expect(r.matrix.find((m) => m.month === 4)!.volatility).toBeNull();
  });

  it('écarte des statistiques un rendement qui enjambe un mois sans échange', () => {
    const r = aggregateSeasonality(
      [...returns, { year: 2019, month: 1, ret: 0.9, gapMonths: 2 }],
      10, now,
    );
    const jan = r.matrix.find((m) => m.month === 1)!;
    expect(jan.n).toBe(6);
    expect(jan.avgReturn).toBeCloseTo(0.2 / 6);
  });

  it('fenêtre glissante : exclut les années hors fenêtre', () => {
    const r = aggregateSeasonality(returns, 5, now);
    expect(r.matrix.find((m) => m.month === 1)!.n).toBe(5);
  });

  it('dataQuality et currentMonthBias', () => {
    const r = aggregateSeasonality(returns, 10, now);
    expect(r.dataQuality).toBe('limited');
    expect(r.currentMonthBias?.month).toBe(1);
  });

  it('aucun mois ne se détache quand toutes les cellules sont du hasard', () => {
    const r = aggregateSeasonality(returns, 10, now);
    expect(r.bestMonth).toBeNull();
    expect(r.worstMonth).toBeNull();
  });

  it('nomme le mois fort et le mois faible seulement s’ils sont au moins indicatifs', () => {
    const fort = [0.04, 0.05, 0.03, 0.06, 0.04, 0.05].map((ret, i) => ({ year: 2020 + i, month: 6, ret, gapMonths: 0 }));
    const faible = [-0.04, -0.05, -0.03, -0.06, -0.04, -0.05].map((ret, i) => ({ year: 2020 + i, month: 9, ret, gapMonths: 0 }));
    // Mars : médiane la plus haute, mais 2 observations seulement.
    const bruit = [0.3, 0.4].map((ret, i) => ({ year: 2024 + i, month: 3, ret, gapMonths: 0 }));
    const r = aggregateSeasonality([...fort, ...faible, ...bruit], 10, new Date('2025-12-15T00:00:00Z'));
    expect(r.bestMonth).toBe(6);
    expect(r.worstMonth).toBe(9);
  });
});

describe('marketMonthlyReturns', () => {
  it('moyenne équipondérée par mois, rendements écrêtés à ±30 %, mois sautés écartés', () => {
    const parValeur: MonthlyReturn[][] = [
      [{ year: 2025, month: 2, ret: 0.10, gapMonths: 0 }, { year: 2025, month: 3, ret: 0.5, gapMonths: 0 }],
      [{ year: 2025, month: 2, ret: 0.02, gapMonths: 0 }, { year: 2025, month: 3, ret: 0.1, gapMonths: 0 }],
      [{ year: 2025, month: 2, ret: 0.9, gapMonths: 3 }],
    ];
    const m = marketMonthlyReturns(parValeur);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ year: 2025, month: 2, gapMonths: 0 });
    expect(m[0]!.ret).toBeCloseTo(0.06);
    expect(m[1]!.ret).toBeCloseTo(0.2); // (0,30 écrêté + 0,10) / 2
  });
});
