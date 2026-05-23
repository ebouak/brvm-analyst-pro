// Indicateurs techniques côté frontend.
// `closes` est ordonné du PLUS ANCIEN au PLUS RÉCENT.
// Les fonctions "série" renvoient un tableau aligné sur `closes` (null en tête
// tant que la fenêtre n'est pas remplie), pratique pour les graphiques.

export function smaSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i]!;
    if (i >= period) sum -= closes[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function sma(closes: number[], period: number): number | null {
  if (period <= 0 || closes.length < period) return null;
  const s = closes.slice(closes.length - period).reduce((a, b) => a + b, 0);
  return s / period;
}

export function emaSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (period <= 0 || closes.length < period) return out;
  const k = 2 / (period + 1);
  let prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < closes.length; i++) {
    prev = closes[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(closes: number[], period = 14): number | null {
  const s = rsiSeries(closes, period);
  return s.length ? s[s.length - 1]! : null;
}

export function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  const deltas: number[] = [];
  for (let i = 1; i < closes.length; i++) deltas.push(closes[i]! - closes[i - 1]!);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const d = deltas[i]!;
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = rsiFrom(avgGain, avgLoss);

  for (let i = period; i < deltas.length; i++) {
    const d = deltas[i]!;
    const gain = d >= 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i + 1] = rsiFrom(avgGain, avgLoss);
  }
  return out;
}

function rsiFrom(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  hist: number | null;
}

// MACD(12,26,9) : série alignée sur closes.
export function macdSeries(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPoint[] {
  const emaFast = emaSeries(closes, fast);
  const emaSlow = emaSeries(closes, slow);
  const macdLine: (number | null)[] = closes.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i]! - emaSlow[i]! : null,
  );
  // EMA du signal calculée sur les valeurs MACD disponibles.
  const firstIdx = macdLine.findIndex((v) => v != null);
  const out: MacdPoint[] = closes.map(() => ({ macd: null, signal: null, hist: null }));
  if (firstIdx < 0) return out;
  const compact = macdLine.slice(firstIdx).map((v) => v ?? 0);
  const sig = emaSeries(compact, signalPeriod);
  for (let i = 0; i < compact.length; i++) {
    const idx = firstIdx + i;
    const m = macdLine[idx];
    const s = sig[i];
    out[idx] = {
      macd: m,
      signal: s,
      hist: m != null && s != null ? m - s : null,
    };
  }
  return out;
}

export interface Detection {
  oversold: boolean; // RSI < 30
  overbought: boolean; // RSI > 70
  goldenCross: boolean; // MA20 croise au-dessus de MA50 récemment
  deathCross: boolean; // MA20 croise en dessous de MA50 récemment
  breakoutUp: boolean; // clôture > plus haut des 20 séances précédentes
  breakoutDown: boolean; // clôture < plus bas des 20 séances précédentes
}

export function detect(closes: number[]): Detection {
  const r = rsi(closes, 14);
  const ma20 = smaSeries(closes, 20);
  const ma50 = smaSeries(closes, 50);
  const n = closes.length;

  let goldenCross = false;
  let deathCross = false;
  if (n >= 51 && ma20[n - 1] != null && ma50[n - 1] != null && ma20[n - 2] != null && ma50[n - 2] != null) {
    const prevDiff = ma20[n - 2]! - ma50[n - 2]!;
    const curDiff = ma20[n - 1]! - ma50[n - 1]!;
    goldenCross = prevDiff <= 0 && curDiff > 0;
    deathCross = prevDiff >= 0 && curDiff < 0;
  }

  let breakoutUp = false;
  let breakoutDown = false;
  if (n >= 21) {
    const window = closes.slice(n - 21, n - 1);
    const hi = Math.max(...window);
    const lo = Math.min(...window);
    const last = closes[n - 1]!;
    breakoutUp = last > hi;
    breakoutDown = last < lo;
  }

  return {
    oversold: r != null && r < 30,
    overbought: r != null && r > 70,
    goldenCross,
    deathCross,
    breakoutUp,
    breakoutDown,
  };
}
