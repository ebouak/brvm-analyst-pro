import { describe, it, expect } from 'vitest';
import { runBacktest } from '../backtest';
import { rateMetric, synthesizeBacktest, type BenchmarkSet } from './interpret';

describe('runBacktest — métriques étendues', () => {
  it('enregistre les trades avec rendement net et clôt la position ouverte', () => {
    // BUY signalé en i=1, exécuté au fixing suivant (i=2, prix 110).
    // SELL signalé en i=3, exécuté au fixing suivant (i=4, prix 120).
    // Le trade capte donc 110 -> 120 = +9,09 %, et NON 100 -> 120 = +20 % :
    // la hausse 100 -> 110 s'est produite le jour même du signal.
    const closes = [100, 100, 110, 120, 120];
    const signals = ['HOLD', 'BUY', 'HOLD', 'SELL', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals], feesPct: 0, slippagePct: 0 });
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]!.entryIndex).toBe(2);
    expect(r.trades[0]!.exitIndex).toBe(4);
    expect(r.trades[0]!.returnPct).toBeCloseTo(0.0909, 3);
    expect(r.trades[0]!.win).toBe(true);
    expect(r.bestTradePct).toBeCloseTo(0.0909, 3);
  });

  it('clôture une position encore ouverte au dernier cours (latent)', () => {
    // BUY signalé en i=1, exécuté en i=2 au prix 130. La série continue jusqu'à
    // 140 : le trade latent vaut donc 130 -> 140 = +7,69 %.
    const closes = [100, 100, 130, 140];
    const signals = ['HOLD', 'BUY', 'HOLD', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals] });
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]!.entryIndex).toBe(2);
    expect(r.trades[0]!.exitIndex).toBeNull();
    expect(r.trades[0]!.returnPct).toBeCloseTo(0.0769, 3);
  });

  it('Sortino/Calmar définis et Sharpe en excès du sans-risque', () => {
    // Hausse globale avec replis périodiques (drawdowns + jours baissiers).
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i + (i % 5 === 0 ? -4 : 0));
    const signals = closes.map((_, i) => (i === 0 ? 'BUY' : 'HOLD')) as ('BUY' | 'HOLD' | 'SELL')[];
    const r = runBacktest({ closes, signals, riskFreeRate: 0.06 });
    expect(r.riskFreeRate).toBe(0.06);
    // Hausse globale => Sortino et Calmar définis et positifs.
    expect(r.sortinoRatio).not.toBeNull();
    expect(r.sortinoRatio!).toBeGreaterThan(0);
    expect(r.calmarRatio).not.toBeNull();
  });
});

describe('rateMetric', () => {
  it('seuils Sharpe', () => {
    expect(rateMetric('sharpe', 1.2).rating).toBe('good');
    expect(rateMetric('sharpe', 0.7).rating).toBe('neutral');
    expect(rateMetric('sharpe', 0.2).rating).toBe('poor');
  });
  it('max drawdown : plus c’est bas mieux c’est', () => {
    expect(rateMetric('maxDrawdown', 0.10).rating).toBe('good');
    expect(rateMetric('maxDrawdown', 0.25).rating).toBe('neutral');
    expect(rateMetric('maxDrawdown', 0.40).rating).toBe('poor');
  });
  it('valeur nulle => neutre', () => {
    expect(rateMetric('sortino', null).rating).toBe('neutral');
  });
});

describe('synthesizeBacktest', () => {
  const bench: BenchmarkSet = { buyHoldReturn: 0.05, indexReturn: 0.08, riskFreeReturn: 0.06 };

  it('bat le marché avec risque maîtrisé => verdict convaincant', () => {
    const r = {
      totalReturn: 0.25, annualizedReturn: 0.18, volatility: 0.15, maxDrawdown: 0.10,
      winRate: 0.6, numTrades: 20, buyAndHoldReturn: 0.05, sharpeRatio: 1.2,
      sortinoRatio: 1.6, calmarRatio: 1.8,
    } as Parameters<typeof synthesizeBacktest>[0];
    const s = synthesizeBacktest(r, bench, 500);
    expect(s.verdict).toMatch(/convaincante/i);
    expect(s.cautions).toHaveLength(0);
  });

  it('peu de trades => caution de significativité', () => {
    const r = {
      totalReturn: 0.30, annualizedReturn: 0.20, volatility: 0.25, maxDrawdown: 0.20,
      winRate: 0.6, numTrades: 3, buyAndHoldReturn: 0.05, sharpeRatio: 0.9,
      sortinoRatio: 1.0, calmarRatio: 1.0,
    } as Parameters<typeof synthesizeBacktest>[0];
    const s = synthesizeBacktest(r, bench, 120);
    expect(s.cautions.some((c) => /peu de trades/i.test(c))).toBe(true);
    expect(s.verdict).toMatch(/échantillon de trades réduit/i);
  });

  it('ne bat pas le Buy & Hold => verdict négatif', () => {
    const r = {
      totalReturn: 0.02, annualizedReturn: 0.01, volatility: 0.30, maxDrawdown: 0.35,
      winRate: 0.4, numTrades: 15, buyAndHoldReturn: 0.20, sharpeRatio: 0.1,
      sortinoRatio: 0.2, calmarRatio: 0.1,
    } as Parameters<typeof synthesizeBacktest>[0];
    const s = synthesizeBacktest(r, bench, 400);
    expect(s.verdict).toMatch(/n’apporte pas de valeur/i);
    expect(s.cautions.some((c) => /achat-conservation/i.test(c))).toBe(true);
  });
});

describe('runBacktest — absence de look-ahead', () => {
  it('n’encaisse PAS le mouvement du jour qui a produit le signal', () => {
    // Le signal BUY tombe en i=1, jour où le cours passe de 100 à 110.
    // Ce mouvement est l'ENTRÉE de la décision : il ne peut pas être capté.
    // Exécution au fixing suivant -> entrée à closes[2] = 110.
    const closes = [100, 110, 110, 121];
    const signals = ['HOLD', 'BUY', 'HOLD', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals], feesPct: 0, slippagePct: 0 });

    // La stratégie ne détient le titre qu'à partir de i=2 : elle capte 110 -> 121,
    // soit +10 %, et non 100 -> 121 (+21 %).
    expect(r.totalReturn).toBeCloseTo(0.10, 3);
    expect(r.trades[0]!.entryIndex).toBe(2);
  });

  it('n’esquive PAS la baisse du jour de vente', () => {
    // SELL en i=2 : la position est encore détenue ce jour-là et subit la baisse.
    // La sortie n'a lieu qu'au fixing suivant, en i=3.
    const closes = [100, 100, 90, 90];
    const signals = ['BUY', 'HOLD', 'SELL', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals], feesPct: 0, slippagePct: 0 });

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]!.exitIndex).toBe(3);
    expect(r.totalReturn).toBeCloseTo(-0.10, 3);
  });
});

describe('runBacktest — frais et cas limites', () => {
  it('les frais réduisent le rendement TOTAL, pas seulement les stats par trade', () => {
    const closes = [100, 100, 110, 110];
    const signals = ['HOLD', 'BUY', 'HOLD', 'HOLD'] as const;
    const sansFrais = runBacktest({ closes, signals: [...signals], feesPct: 0 });
    const avecFrais = runBacktest({ closes, signals: [...signals], feesPct: 0.01 });
    // Avant correction, les deux totalReturn étaient IDENTIQUES : les frais
    // n'atteignaient jamais la courbe d'equity.
    expect(avecFrais.totalReturn).toBeLessThan(sansFrais.totalReturn);
  });

  it('un signal sur la dernière séance n’est jamais exécuté', () => {
    // L'ordre ne peut pas s'exécuter : il n'y a pas de séance suivante.
    // Un backtest n'invente pas une transaction qui n'aurait pas eu lieu.
    const closes = [100, 100, 100];
    const signals = ['HOLD', 'HOLD', 'BUY'] as const;
    const r = runBacktest({ closes, signals: [...signals] });
    expect(r.trades).toHaveLength(0);
    expect(r.totalReturn).toBeCloseTo(0, 6);
  });

  it('chaque ordre s’exécute à la séance suivante, sans jamais rester en attente', () => {
    // BUY signalé en i=0 -> exécuté en i=1. SELL signalé en i=1 (après cette
    // exécution, l'étape d'exécution précédant l'enregistrement du signal) ->
    // exécuté en i=2. Un aller-retour complet, entrée 110 et sortie 120.
    //
    // Ce test fixe une propriété structurelle : un ordre en attente ne survit
    // JAMAIS plus d'une séance. Le cas « ordre contraire remplaçant un ordre
    // encore en attente » est donc inatteignable par construction — la spec le
    // décrivait à tort comme une situation à gérer.
    const closes = [100, 110, 120, 130];
    const signals = ['BUY', 'SELL', 'HOLD', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals], feesPct: 0 });
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]!.entryIndex).toBe(1);
    expect(r.trades[0]!.exitIndex).toBe(2);
    expect(r.trades[0]!.returnPct).toBeCloseTo(120 / 110 - 1, 4);
  });

  it('série de moins de 2 points : résultat vide, aucune exception', () => {
    const r = runBacktest({ closes: [100], signals: ['BUY'] });
    expect(r.trades).toHaveLength(0);
    expect(r.totalReturn).toBe(0);
    expect(r.numTrades).toBe(0);
  });
});
