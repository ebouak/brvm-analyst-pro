# Backtest pédagogique & méthodes d'analyste — Design

**Date :** 2026-06-13
**Objectif :** rendre la page Backtest compréhensible (pédagogie + verdict de
synthèse, comme le signal) et y appliquer les meilleures méthodes d'analyste
financier (ratios de risque, benchmark de marché, détail trade par trade lié
aux signaux).

## Décisions (brainstorming)

- Benchmarks : **Buy & Hold + indice BRVM-C + taux sans risque ~6 %**.
- Détail **trade par trade + marqueurs** sur le graphe (lien avec les signaux).
- Métriques pro ajoutées : **Sortino + Calmar** (ratios de risque).
- Périmètre : **frontend** (le backtest scraper reste découplé).

## Architecture

```
frontend/lib/backtest.ts          (étendu : Sortino, Calmar, trades, riskFreeRate)
frontend/lib/backtest/interpret.ts (nouveau : rateMetric + synthesizeBacktest)
frontend/lib/backtest/*.test.ts    (vitest)
frontend/components/BacktestMetrics.tsx   (refonte pédagogique)
frontend/components/BacktestTrades.tsx    (nouveau : tableau des trades)
frontend/components/BacktestSynthesis.tsx (nouveau : verdict)
frontend/components/BacktestChart.tsx     (marqueurs BUY/SELL)
frontend/app/backtest/page.tsx            (fetch BRVM-C, câblage)
```

### `lib/backtest.ts` — extensions

```ts
interface Trade {
  entryIndex: number; exitIndex: number | null;
  entryDate?: string; exitDate?: string;
  entryPrice: number; exitPrice: number | null;
  returnPct: number | null;   // net de frais/slippage
  bars: number | null;        // durée en séances
  win: boolean | null;
}

interface BacktestResult {
  /* …existant… */
  sortinoRatio: number | null;  // (annualisé − rf) / downside deviation annualisée
  calmarRatio: number | null;   // annualisé / maxDrawdown
  trades: Trade[];
  avgWinPct: number | null; avgLossPct: number | null;
  bestTradePct: number | null; worstTradePct: number | null;
}
```
- Nouveau param `riskFreeRate = 0.06`. Sharpe et Sortino en **excès** sur rf.
- Downside deviation : écart-type des rendements quotidiens négatifs (sous rf
  quotidien), annualisé ×√252.
- Un trade ouvert non clôturé à la fin est marqué `exitIndex=null` (clôturé au
  dernier cours pour le rendement latent affiché).

### `lib/backtest/interpret.ts` — nouveau (pur)

```ts
type Rating = 'good' | 'neutral' | 'poor';
interface MetricRating { rating: Rating; explanation: string; }
function rateMetric(key: MetricKey, value: number | null): MetricRating;

interface BenchmarkSet {
  buyHoldReturn: number;
  indexReturn: number | null;   // BRVM-C sur la fenêtre
  riskFreeReturn: number;       // (1+rf)^(n/252) − 1
}
interface BacktestSynthesis { verdict: string; rationale: string[]; cautions: string[]; }
function synthesizeBacktest(r: BacktestResult, b: BenchmarkSet, n: number): BacktestSynthesis;
```

Seuils analystes (rateMetric) :
- Sharpe : >1 good, 0.5–1 neutral, <0.5 poor.
- Sortino : >1.5 good, 0.75–1.5 neutral, <0.75 poor.
- Calmar : >1 good, 0.5–1 neutral, <0.5 poor.
- maxDrawdown : <15 % good, 15–30 % neutral, >30 % poor.
- winRate : >55 % good, 45–55 % neutral, <45 % poor.

`synthesizeBacktest` : verdict réconciliant rendement, risque, alpha vs marché
et significativité (numTrades < 10 → caution « peu significatif »).

### Benchmarks (page)
`brvm_indices_daily` filtré sur le code composite (BRVM-C) + fenêtre de dates →
`indexReturn = (dernier − premier)/premier`. `riskFreeReturn` dérivé de rf et n.

### Affichage
- **Bandeau comparaison** : Stratégie / Buy & Hold / BRVM-C / sans-risque, avec
  alpha vs marché.
- **BacktestMetrics** : 3 groupes (Performance, Risque, Exécution) ; chaque carte
  colorée selon `rateMetric` + légende « ce que ça mesure ».
- **BacktestTrades** : tableau (entrée/sortie, signal, rendement, durée, win/loss)
  + résumé (gain/perte moyens, meilleur/pire).
- **BacktestSynthesis** : verdict + raisons + cautions.
- **BacktestChart** : marqueurs BUY (entrée) / SELL (sortie).

## États limites
- Pas d'indice BRVM-C sur la fenêtre → ligne marché masquée, reste affiché.
- < 2 séances → état vide existant.
- 0 trade → tableau vide + caution.
- vol = 0 → Sharpe/Sortino null (« — »).

## Tests (vitest)
- backtest étendu : Sortino/Calmar cohérents, trades correctement bornés,
  rf pris en compte.
- rateMetric : seuils bon/neutre/faible.
- synthesizeBacktest : bat le marché + DD élevé + peu de trades → verdict nuancé
  + cautions appropriées.
