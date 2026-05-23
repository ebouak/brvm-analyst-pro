import { describe, it, expect } from 'vitest';
// Chemin cross-package : le scraper n'a pas de dépendance npm sur frontend, on référence directement le source TS.
import { runBacktest } from '../../frontend/lib/backtest.js';
import type { SignalLabel } from '../../frontend/lib/types.js';

describe('runBacktest', () => {
  it('haussière linéaire BUY→SELL : trade gagnant, winRate=1, totalReturn>0', () => {
    const n = 11;
    const closes = Array.from({ length: n }, (_, i) => 10 + i); // 10,11,...,20
    const signals: SignalLabel[] = ['BUY', ...Array(n - 2).fill('HOLD'), 'SELL'];

    const result = runBacktest({ closes, signals });

    expect(result.numTrades).toBe(1);
    expect(result.winRate).toBe(1);
    expect(result.totalReturn).toBeGreaterThan(0);
    expect(result.equityCurve).toHaveLength(n);
    expect(result.equityCurve[n - 1].value).toBeGreaterThan(100);
  });

  it('aucun BUY → numTrades=0, totalReturn=0, equity toujours à 100', () => {
    const closes = [100, 110, 90, 105, 115];
    const signals: SignalLabel[] = ['HOLD', 'HOLD', 'HOLD', 'HOLD', 'HOLD'];

    const result = runBacktest({ closes, signals });

    expect(result.numTrades).toBe(0);
    expect(result.totalReturn).toBe(0);
    result.equityCurve.forEach(p => expect(p.value).toBeCloseTo(100));
  });

  it('BUY immédiat sans SELL → position tenue, equity finale = cours final / cours initial * 100', () => {
    const closes = [10, 12, 15, 14, 20];
    const signals: SignalLabel[] = ['BUY', 'HOLD', 'HOLD', 'HOLD', 'HOLD'];

    const result = runBacktest({ closes, signals });

    const expected = (20 / 10) * 100;
    expect(result.equityCurve[4].value).toBeCloseTo(expected, 5);
    expect(result.numTrades).toBe(1);
    expect(result.winRate).toBe(0); // no closed trade
  });

  it('max drawdown : série 100,120,80,90 avec BUY au début → drawdown ≈ (120-80)/120', () => {
    const closes = [100, 120, 80, 90];
    const signals: SignalLabel[] = ['BUY', 'HOLD', 'HOLD', 'HOLD'];

    const result = runBacktest({ closes, signals });

    const expectedDrawdown = (120 - 80) / 120;
    expect(result.maxDrawdown).toBeCloseTo(expectedDrawdown, 5);
  });

  it('throw si closes.length ≠ signals.length', () => {
    expect(() =>
      runBacktest({ closes: [100, 110, 120], signals: ['BUY', 'HOLD'] })
    ).toThrow();
  });

  it('série décroissante BUY→SELL : trade perdant, winRate=0', () => {
    const n = 11;
    const closes = Array.from({ length: n }, (_, i) => 20 - i); // 20,19,...,10
    const signals: SignalLabel[] = ['BUY', ...Array(n - 2).fill('HOLD'), 'SELL'];

    const result = runBacktest({ closes, signals });

    expect(result.numTrades).toBe(1);
    expect(result.winRate).toBe(0);
    expect(result.totalReturn).toBeLessThan(0);
  });

  it('deux trades successifs BUY→SELL→BUY→SELL : numTrades=2, winRate calculé sur les deux', () => {
    const closes = [10, 15, 15, 20, 20, 10]; // trade1 gagnant (10→15), trade2 perdant (20→10)
    const signals: SignalLabel[] = ['BUY', 'SELL', 'BUY', 'HOLD', 'HOLD', 'SELL'];

    const result = runBacktest({ closes, signals });

    expect(result.numTrades).toBe(2);
    // 1 gagnant sur 2 fermés
    expect(result.winRate).toBeCloseTo(0.5);
  });
});
