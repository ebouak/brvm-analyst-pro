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

  it('BUY immédiat sans SELL → entrée au fixing suivant, equity = cours final / cours d’entrée * 100', () => {
    const closes = [10, 12, 15, 14, 20];
    const signals: SignalLabel[] = ['BUY', 'HOLD', 'HOLD', 'HOLD', 'HOLD'];

    const result = runBacktest({ closes, signals });

    // BUY signalé en i=0, exécuté au fixing suivant (i=1, cours 12) — et NON au
    // cours initial 10 : on ne peut pas acheter au cours qui a produit le signal.
    // Equity finale = 20 / 12 * 100, pas 20 / 10 * 100.
    const expected = (20 / 12) * 100;
    expect(result.equityCurve[4].value).toBeCloseTo(expected, 5);
    expect(result.numTrades).toBe(1);
    // Le trade latent (12 -> 20) est gagnant : winRate compte désormais la
    // position ouverte, sur le même dénominateur que les autres statistiques.
    expect(result.winRate).toBe(1);
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
    // Données choisies pour l'exécution au fixing suivant : chaque ordre
    // s'exécute à la séance qui suit son signal.
    //  BUY i=0 -> entrée i=1 (12) ; SELL i=1 -> sortie i=2 (18)  => trade1 gagnant
    //  BUY i=2 -> entrée i=3 (20) ; SELL i=3 -> sortie i=4 (15)  => trade2 perdant
    const closes = [10, 12, 18, 20, 15, 15];
    const signals: SignalLabel[] = ['BUY', 'SELL', 'BUY', 'SELL', 'HOLD', 'HOLD'];

    const result = runBacktest({ closes, signals });

    expect(result.numTrades).toBe(2);
    expect(result.trades[0]!.win).toBe(true);
    expect(result.trades[1]!.win).toBe(false);
    expect(result.winRate).toBeCloseTo(0.5);
  });
});
