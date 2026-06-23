import { describe, it, expect } from 'vitest';
import { monthlyReturnsFromPrices, aggregateSeasonality, type MonthlyReturn } from './compute';

describe('monthlyReturnsFromPrices', () => {
  it('calcule le rendement mois-sur-mois (dernier close du mois)', () => {
    const prices = [
      { date: '2025-01-10', close: 100 },
      { date: '2025-01-31', close: 110 },
      { date: '2025-02-15', close: 120 },
      { date: '2025-02-28', close: 121 },
    ];
    const r = monthlyReturnsFromPrices(prices);
    expect(r).toEqual([{ year: 2025, month: 2, ret: 121 / 110 - 1 }]);
  });

  it('omet un mois sans séance (gap) et chaîne sur le dernier mois coté', () => {
    const prices = [
      { date: '2025-01-31', close: 100 },
      { date: '2025-03-31', close: 120 },
    ];
    const r = monthlyReturnsFromPrices(prices);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ year: 2025, month: 3 });
    expect(r[0]!.ret).toBeCloseTo(0.2);
  });

  it('renvoie [] si moins de 2 mois cotés', () => {
    expect(monthlyReturnsFromPrices([{ date: '2025-01-31', close: 100 }])).toEqual([]);
  });
});

describe('aggregateSeasonality', () => {
  const returns: MonthlyReturn[] = [
    { year: 2020, month: 1, ret: 0.10 },
    { year: 2021, month: 1, ret: -0.10 },
    { year: 2022, month: 1, ret: 0.20 },
    { year: 2023, month: 1, ret: 0.0 },
    { year: 2024, month: 1, ret: 0.05 },
    { year: 2025, month: 1, ret: -0.05 },
  ];
  const now = new Date('2025-01-15T00:00:00Z');

  it('agrège moyenne, bullPct et n pour un mois', () => {
    const r = aggregateSeasonality(returns, 10, now);
    const jan = r.matrix.find((m) => m.month === 1)!;
    expect(jan.n).toBe(6);
    expect(jan.avgReturn).toBeCloseTo((0.10 - 0.10 + 0.20 + 0 + 0.05 - 0.05) / 6);
    expect(jan.bullPct).toBeCloseTo((3 / 6) * 100);
    expect(jan.reliability).toBe('medium');
  });

  it('volatility = null quand n < 3', () => {
    const r = aggregateSeasonality(
      [{ year: 2024, month: 3, ret: 0.1 }, { year: 2025, month: 3, ret: 0.2 }],
      10, now,
    );
    expect(r.matrix.find((m) => m.month === 3)!.volatility).toBeNull();
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

  it('bestMonth/worstMonth ignorent les mois n=0', () => {
    const r = aggregateSeasonality(returns, 10, now);
    expect(r.bestMonth).toBe(1);
    expect(r.worstMonth).toBe(1);
  });
});
