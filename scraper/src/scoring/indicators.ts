/**
 * Indicateurs techniques (fonctions pures, testables).
 * Conventions :
 *   - L'entrée `closes` est ordonnée du PLUS ANCIEN au PLUS RÉCENT.
 *   - Toute fonction renvoie `null` si l'historique est insuffisant
 *     (permet de neutraliser proprement les signaux — cf. §9).
 */

/** Moyenne mobile simple sur les `period` dernières valeurs. */
export function sma(closes: number[], period: number): number | null {
  if (period <= 0 || closes.length < period) return null;
  const slice = closes.slice(closes.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/** Moyenne mobile exponentielle (dernière valeur de l'EMA). */
export function ema(closes: number[], period: number): number | null {
  if (period <= 0 || closes.length < period) return null;
  const k = 2 / (period + 1);
  // Seed = SMA des `period` premières valeurs.
  let prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    prev = closes[i]! * k + prev * (1 - k);
  }
  return prev;
}

/**
 * RSI de Wilder. `period` = 14 par défaut.
 * Renvoie une valeur dans [0, 100], ou null si < period+1 points.
 * Si aucune perte sur la fenêtre => 100 ; aucune hausse => 0.
 */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  // Variations successives.
  const deltas: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    deltas.push(closes[i]! - closes[i - 1]!);
  }

  // Moyennes initiales (Wilder) sur les `period` premières variations.
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const d = deltas[i]!;
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;

  // Lissage de Wilder sur le reste.
  for (let i = period; i < deltas.length; i++) {
    const d = deltas[i]!;
    const gain = d >= 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Série complète d'EMA (une valeur par point à partir de l'indice `period-1`).
 * Nécessaire pour le MACD (la ligne de signal est l'EMA de la ligne MACD).
 * Renvoie [] si l'historique est insuffisant.
 */
export function emaSeries(closes: number[], period: number): number[] {
  if (period <= 0 || closes.length < period) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < closes.length; i++) {
    prev = closes[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/**
 * MACD complet : ligne, signal, histogramme (dernières valeurs).
 * MACD = EMA(fast) − EMA(slow) ; signal = EMA(signalPeriod) de la ligne MACD ;
 * histogramme = MACD − signal. Renvoie null si l'historique est insuffisant
 * (il faut au moins slow + signalPeriod − 1 points pour un histogramme fiable).
 */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { line: number; signal: number; histogram: number } | null {
  if (closes.length < slow + signalPeriod - 1) return null;

  // Séries EMA fast/slow alignées sur l'indice le plus ANCIEN commun.
  const emaFastFull = emaSeries(closes, fast); // commence à l'indice fast-1
  const emaSlowFull = emaSeries(closes, slow); // commence à l'indice slow-1
  if (emaFastFull.length === 0 || emaSlowFull.length === 0) return null;

  // Aligne : la série MACD commence à l'indice slow-1 (le plus tardif des deux).
  const offset = slow - fast; // décalage de départ entre fast et slow
  const macdLineSeries: number[] = [];
  for (let i = 0; i < emaSlowFull.length; i++) {
    const fastVal = emaFastFull[i + offset];
    if (fastVal == null) break;
    macdLineSeries.push(fastVal - emaSlowFull[i]!);
  }
  if (macdLineSeries.length < signalPeriod) return null;

  const signalSeries = emaSeries(macdLineSeries, signalPeriod);
  if (signalSeries.length === 0) return null;

  const line = macdLineSeries[macdLineSeries.length - 1]!;
  const signal = signalSeries[signalSeries.length - 1]!;
  return { line, signal, histogram: line - signal };
}

/** Borne une valeur dans [min, max]. */
export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
