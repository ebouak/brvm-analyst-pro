/**
 * Interprétation pédagogique d'un backtest : note chaque métrique selon les
 * seuils d'usage des analystes, et produit un verdict de synthèse nuancé
 * réconciliant rendement, risque, alpha vs marché et significativité.
 *
 * Fonctions pures et testables.
 */

import type { BacktestResult } from '../backtest';

export type Rating = 'good' | 'neutral' | 'poor';

export interface MetricRating {
  rating: Rating;
  explanation: string;
}

export type MetricKey =
  | 'sharpe' | 'sortino' | 'calmar' | 'maxDrawdown' | 'winRate' | 'volatility';

/** Note une métrique selon des seuils d'analyste. value null => neutre/—. */
export function rateMetric(key: MetricKey, value: number | null): MetricRating {
  if (value == null || Number.isNaN(value)) {
    return { rating: 'neutral', explanation: 'Donnée indisponible.' };
  }
  switch (key) {
    case 'sharpe':
      return {
        rating: value > 1 ? 'good' : value >= 0.5 ? 'neutral' : 'poor',
        explanation: 'Rendement excédentaire par unité de risque total. > 1 est solide.',
      };
    case 'sortino':
      return {
        rating: value > 1.5 ? 'good' : value >= 0.75 ? 'neutral' : 'poor',
        explanation: 'Comme le Sharpe mais ne pénalise que la volatilité baissière. > 1,5 est solide.',
      };
    case 'calmar':
      return {
        rating: value > 1 ? 'good' : value >= 0.5 ? 'neutral' : 'poor',
        explanation: 'Rendement annualisé rapporté à la pire perte (max drawdown). > 1 est sain.',
      };
    case 'maxDrawdown':
      // value = fraction positive (ex. 0.18 = -18%)
      return {
        rating: value < 0.15 ? 'good' : value <= 0.30 ? 'neutral' : 'poor',
        explanation: 'Pire perte depuis un sommet. < 15 % est maîtrisé, > 30 % est sévère.',
      };
    case 'winRate':
      return {
        rating: value > 0.55 ? 'good' : value >= 0.45 ? 'neutral' : 'poor',
        explanation: 'Part des trades gagnants. > 55 % est favorable.',
      };
    case 'volatility':
      return {
        rating: value < 0.20 ? 'good' : value <= 0.35 ? 'neutral' : 'poor',
        explanation: 'Amplitude annualisée des variations. Plus c\'est bas, plus c\'est régulier.',
      };
  }
}

export interface BenchmarkSet {
  buyHoldReturn: number;
  indexReturn: number | null; // BRVM-C sur la fenêtre
  riskFreeReturn: number;     // (1+rf)^(n/252) − 1
}

export interface BacktestSynthesis {
  verdict: string;
  rationale: string[];
  cautions: string[];
}

const SIGNIFICANCE_MIN_TRADES = 10;

export function synthesizeBacktest(
  r: BacktestResult,
  b: BenchmarkSet,
  n: number,
): BacktestSynthesis {
  const rationale: string[] = [];
  const cautions: string[] = [];

  const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

  // 1) Rendement absolu + alpha vs marché.
  rationale.push(`Rendement de la stratégie : ${pct(r.totalReturn)} (annualisé ${pct(r.annualizedReturn)}).`);

  const beatsBH = r.totalReturn > b.buyHoldReturn;
  rationale.push(
    `${beatsBH ? 'Bat' : 'Sous-performe'} le Buy & Hold (${pct(b.buyHoldReturn)}) de ${pct(Math.abs(r.totalReturn - b.buyHoldReturn))}.`,
  );

  let beatsMarket: boolean | null = null;
  if (b.indexReturn != null) {
    beatsMarket = r.totalReturn > b.indexReturn;
    const alpha = r.totalReturn - b.indexReturn;
    rationale.push(`Alpha vs marché (BRVM-C ${pct(b.indexReturn)}) : ${pct(alpha)}.`);
  }

  rationale.push(`Au-dessus du sans-risque (${pct(b.riskFreeReturn)}) : ${r.totalReturn > b.riskFreeReturn ? 'oui' : 'non'}.`);

  // 2) Risque.
  rationale.push(`Risque : max drawdown ${pct(-r.maxDrawdown)}, volatilité ${(r.volatility * 100).toFixed(1)}%.`);

  // Cautions.
  if (r.maxDrawdown > 0.30) cautions.push(`Drawdown sévère (${pct(-r.maxDrawdown)}) : pertes potentielles importantes en cours de route.`);
  if (r.numTrades < SIGNIFICANCE_MIN_TRADES) cautions.push(`Peu de trades (${r.numTrades}) : résultats peu significatifs statistiquement.`);
  if (r.sharpeRatio != null && r.sharpeRatio < 0.5) cautions.push('Ratio de Sharpe faible : le rendement ne rémunère pas bien le risque pris.');
  if (!beatsBH) cautions.push('La stratégie ne bat pas un simple achat-conservation sur la période.');

  // 3) Verdict synthétique.
  const goodRisk = r.maxDrawdown < 0.15 && (r.sharpeRatio == null || r.sharpeRatio >= 1);
  let verdict: string;
  if (beatsMarket === true && beatsBH && goodRisk) {
    verdict = 'Stratégie convaincante : elle bat le marché et le Buy & Hold avec un risque maîtrisé.';
  } else if (beatsBH && !goodRisk) {
    verdict = 'Surperformance obtenue au prix d’un risque élevé : intéressant mais à tempérer (drawdown / Sharpe).';
  } else if (!beatsBH) {
    verdict = 'Sur cette période, la stratégie n’apporte pas de valeur face à un simple achat-conservation.';
  } else {
    verdict = 'Résultats mitigés : la performance existe mais le risque ou la significativité statistique la nuancent.';
  }
  if (r.numTrades < SIGNIFICANCE_MIN_TRADES) {
    verdict += ' À confirmer sur un historique plus long (échantillon de trades réduit).';
  }

  return { verdict, rationale, cautions };
}
