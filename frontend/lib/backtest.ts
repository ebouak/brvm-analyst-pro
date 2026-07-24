import type { SignalLabel } from './types';

export interface BacktestInput {
  closes: number[];
  signals: SignalLabel[];
  dates?: string[];      // optional ISO dates for each close point
  feesPct?: number;      // default 0 (e.g. 0.006 = 0.6%)
  slippagePct?: number;  // default 0
  riskFreeRate?: number; // taux sans risque annuel (défaut 0.06 UEMOA)
}

/** Un aller-retour (entrée BUY → sortie SELL ou clôture au dernier cours). */
export interface Trade {
  entryIndex: number;
  exitIndex: number | null;   // null = position encore ouverte en fin de période
  entryDate?: string;
  exitDate?: string;
  entryPrice: number;         // net frais/slippage d'entrée
  exitPrice: number | null;   // net frais/slippage de sortie
  returnPct: number | null;   // rendement net du trade
  bars: number | null;        // durée en séances
  win: boolean | null;
}

export interface BacktestResult {
  equityCurve: { date_index: number; date?: string; value: number }[];
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  maxDrawdown: number;
  winRate: number;
  numTrades: number;
  buyAndHoldReturn: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  drawdownPeriods: { start: number; end: number }[];
  trades: Trade[];
  avgWinPct: number | null;
  avgLossPct: number | null;
  bestTradePct: number | null;
  worstTradePct: number | null;
  riskFreeRate: number;
  /** true = annualisé sur le temps calendaire réel ; false = repli 252 séances
   *  (aucune date fournie). L'interface ne doit jamais présenter le repli comme
   *  une mesure. */
  annualisationCalendaire: boolean;
}

const EMPTY_RESULT = (n: number, riskFreeRate: number): BacktestResult => ({
  equityCurve: Array.from({ length: n }, (_, i) => ({ date_index: i, value: 100 })),
  totalReturn: 0,
  annualizedReturn: 0,
  volatility: 0,
  maxDrawdown: 0,
  winRate: 0,
  numTrades: 0,
  buyAndHoldReturn: 0,
  sharpeRatio: null,
  sortinoRatio: null,
  calmarRatio: null,
  drawdownPeriods: [],
  trades: [],
  avgWinPct: null,
  avgLossPct: null,
  bestTradePct: null,
  worstTradePct: null,
  riskFreeRate,
  annualisationCalendaire: false,
});

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function runBacktest(input: BacktestInput): BacktestResult {
  const { closes, signals, dates, feesPct = 0, slippagePct = 0, riskFreeRate = 0.06 } = input;

  if (closes.length !== signals.length) {
    throw new Error(
      `closes and signals must have the same length (got ${closes.length} vs ${signals.length})`
    );
  }

  const n = closes.length;

  if (n < 2) {
    return EMPTY_RESULT(n, riskFreeRate);
  }

  const equityCurve: { date_index: number; date?: string; value: number }[] = [];
  const dailyReturns: number[] = [];

  let equity = 100;
  let inPosition = false;
  let entryPrice = 0;
  let entryIndex = 0;

  let peakEquity = 100;
  let maxDrawdown = 0;

  const trades: Trade[] = [];

  // Coût aller (ou retour) d'une transaction : frais + slippage.
  const coutTransaction = feesPct + slippagePct;

  // Ordre décidé la veille, exécuté aujourd'hui à la clôture. Porte le délai
  // d'une séance : on ne peut pas acheter à un cours qui est lui-même l'entrée
  // de la décision.
  let ordreEnAttente: 'BUY' | 'SELL' | null = null;

  for (let i = 0; i < n; i++) {
    // (a) Rendement du jour — dépend de la position détenue DEPUIS LA VEILLE.
    //     C'est cet ordre qui élimine le biais de look-ahead.
    const prec = closes[i - 1];
    const cours = closes[i];
    let dayReturn = 0;
    if (inPosition && i > 0 && prec != null && prec !== 0 && cours != null) {
      dayReturn = (cours - prec) / prec;
    }
    dailyReturns.push(dayReturn);
    equity = equity * (1 + dayReturn);

    // (b) Exécution de l'ordre décidé la veille, à la clôture d'aujourd'hui.
    //     Les frais frappent l'equity : sans cela, totalReturn et maxDrawdown
    //     resteraient bruts alors que les stats par trade sont nettes.
    const prix = cours ?? 0;
    if (ordreEnAttente === 'BUY' && !inPosition) {
      inPosition = true;
      entryIndex = i;
      entryPrice = prix * (1 + coutTransaction);
      equity = equity * (1 - coutTransaction);
    } else if (ordreEnAttente === 'SELL' && inPosition) {
      const prixSortie = prix * (1 - coutTransaction);
      equity = equity * (1 - coutTransaction);
      inPosition = false;
      const tr: Trade = {
        entryIndex,
        exitIndex: i,
        entryPrice,
        exitPrice: prixSortie,
        returnPct: entryPrice !== 0 ? prixSortie / entryPrice - 1 : 0,
        bars: i - entryIndex,
        win: prixSortie > entryPrice,
      };
      if (dates) {
        if (dates[entryIndex] !== undefined) tr.entryDate = dates[entryIndex];
        if (dates[i] !== undefined) tr.exitDate = dates[i];
      }
      trades.push(tr);
    }
    ordreEnAttente = null;

    // (c) Le signal d'aujourd'hui devient l'ordre de demain.
    //
    //     L'étape (b) précédant celle-ci, un ordre en attente ne survit jamais
    //     plus d'une séance : il s'exécute ou il est abandonné. Aucun ordre
    //     contraire ne peut donc en « remplacer » un autre encore en attente.
    //
    //     Un signal tombant sur la dernière séance ne s'exécute jamais : un
    //     backtest n'invente pas une transaction qui n'aurait pas eu lieu.
    const signal = signals[i];
    if (signal === 'BUY' && !inPosition) ordreEnAttente = 'BUY';
    else if (signal === 'SELL' && inPosition) ordreEnAttente = 'SELL';

    const pt: { date_index: number; date?: string; value: number } = {
      date_index: i,
      value: equity,
    };
    if (dates && dates[i] !== undefined) {
      pt.date = dates[i];
    }
    equityCurve.push(pt);

    if (equity > peakEquity) peakEquity = equity;
    const drawdown = (peakEquity - equity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Compute drawdown periods
  const drawdownPeriods: { start: number; end: number }[] = [];
  let peak = equityCurve[0]?.value ?? 100;
  let inDrawdown = false;
  let ddStart = 0;

  for (let i = 0; i < equityCurve.length; i++) {
    const val = equityCurve[i]!.value;
    if (val > peak) {
      if (inDrawdown) {
        drawdownPeriods.push({ start: ddStart, end: i - 1 });
        inDrawdown = false;
      }
      peak = val;
    } else if (val < peak && !inDrawdown) {
      inDrawdown = true;
      ddStart = i;
    }
  }
  if (inDrawdown) {
    drawdownPeriods.push({ start: ddStart, end: equityCurve.length - 1 });
  }

  // Position encore ouverte en fin de période : trade latent valorisé au dernier
  // cours, frais de sortie inclus pour rester cohérent avec les trades clôturés.
  if (inPosition) {
    const dernier = (closes[n - 1] ?? 0) * (1 - coutTransaction);
    const tr: Trade = {
      entryIndex,
      exitIndex: null,
      entryPrice,
      exitPrice: dernier,
      returnPct: entryPrice !== 0 ? dernier / entryPrice - 1 : 0,
      bars: n - 1 - entryIndex,
      win: dernier > entryPrice,
    };
    if (dates && dates[entryIndex] !== undefined) tr.entryDate = dates[entryIndex];
    trades.push(tr);
  }

  const finalEquity = equity;
  const totalReturn = finalEquity / 100 - 1;

  // Annualisation sur le temps RÉELLEMENT écoulé. Sur la BRVM un titre peut
  // coter 40 fois dans l'année : 252/n serait sans rapport avec la réalité.
  // Sans dates, on retombe exactement sur l'ancienne convention (n/252 années
  // donne pow(eq, 252/n)), signalée par annualisationCalendaire=false.
  const premiereDate = dates?.[0];
  const derniereDate = dates?.[n - 1];
  const joursEcoules =
    premiereDate && derniereDate
      ? (Date.parse(derniereDate) - Date.parse(premiereDate)) / 86_400_000
      : NaN;
  const annualisationCalendaire = Number.isFinite(joursEcoules) && joursEcoules > 0;
  const anneesBrutes = annualisationCalendaire ? joursEcoules / 365.25 : n / 252;
  const annees = Math.max(anneesBrutes, 1 / 365.25);   // jamais zéro

  const annualizedReturn = Math.pow(finalEquity / 100, 1 / annees) - 1;

  // Volatilité mise à l'échelle du nombre RÉEL de séances par an.
  const seancesParAn = n / annees;
  const vol = stddev(dailyReturns) * Math.sqrt(seancesParAn);

  // winRate, avgWinPct et bestTradePct partagent désormais le MÊME tableau
  // `trades`, position latente incluse. Auparavant la position encore ouverte
  // comptait dans les uns et pas dans l'autre.
  const winRate = trades.length > 0
    ? trades.filter((t) => t.win === true).length / trades.length
    : 0;
  const numTrades = trades.length;

  const premierCours = closes[0];
  const dernierCours = closes[n - 1];
  const buyAndHoldReturn =
    premierCours != null && premierCours !== 0 && dernierCours != null
      ? (dernierCours - premierCours) / premierCours
      : 0;

  // Sharpe / Sortino en EXCÈS sur le taux sans risque (best practice analyste).
  // Taux sans risque ramené à la séance, sur le rythme réel de cotation.
  const rfSeance = Math.pow(1 + riskFreeRate, 1 / Math.max(seancesParAn, 1)) - 1;
  const excessAnnual = annualizedReturn - riskFreeRate;
  const sharpeRatio = vol === 0 ? null : excessAnnual / vol;

  // Downside deviation : écart-type des rendements sous le seuil sans risque.
  const downside = dailyReturns.map((r) => Math.min(0, r - rfSeance));
  const downsideVar = downside.reduce((s, v) => s + v * v, 0) / downside.length;
  const downsideDev = Math.sqrt(downsideVar) * Math.sqrt(252);
  const sortinoRatio = downsideDev === 0 ? null : excessAnnual / downsideDev;

  const calmarRatio = maxDrawdown === 0 ? null : annualizedReturn / maxDrawdown;

  // Statistiques d'exécution (sur trades avec rendement connu).
  const rets = trades.map((t) => t.returnPct).filter((r): r is number => r != null);
  const wins = rets.filter((r) => r > 0);
  const losses = rets.filter((r) => r <= 0);
  const avg = (arr: number[]): number | null => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return {
    equityCurve,
    totalReturn,
    annualizedReturn,
    volatility: vol,
    maxDrawdown,
    winRate,
    numTrades,
    buyAndHoldReturn,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    drawdownPeriods,
    trades,
    avgWinPct: avg(wins),
    avgLossPct: avg(losses),
    bestTradePct: rets.length ? Math.max(...rets) : null,
    worstTradePct: rets.length ? Math.min(...rets) : null,
    riskFreeRate,
    annualisationCalendaire,
  };
}
