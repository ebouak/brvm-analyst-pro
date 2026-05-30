// lib/scanner.ts — Logique pure du scanner technique BRVM

export interface ScannerCriteria {
  signal?: 'BUY' | 'HOLD' | 'SELL';
  rsiBucket?: 'oversold' | 'low' | 'mid' | 'overbought';
  maTrend?: 'above_ma20' | 'above_ma50' | 'above_ma200' | 'above_ma20_50';
  macdDir?: 'bullish' | 'bearish';
  volumeRatio?: 2 | 5;
  variationDir?: 'up_2' | 'up_5' | 'down_2' | 'down_5';
  secteur?: string;
}

export interface ScanRow {
  code: string;
  designation: string | null;
  secteur: string | null;
  cours_jour: number | null;
  variation_pct: number | null;
  volume: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  volumeAvg20: number | null;
  signal: 'BUY' | 'HOLD' | 'SELL' | null;
  score: number | null;
  confiance: number | null;
}

export function matchesCriteria(row: ScanRow, c: ScannerCriteria): boolean {
  // Signal filter
  if (c.signal && row.signal !== c.signal) return false;

  // RSI bucket
  if (c.rsiBucket) {
    const r = row.rsi;
    if (r == null) return false;
    if (c.rsiBucket === 'oversold' && !(r < 30)) return false;
    if (c.rsiBucket === 'low' && !(r >= 30 && r < 50)) return false;
    if (c.rsiBucket === 'mid' && !(r >= 50 && r <= 70)) return false;
    if (c.rsiBucket === 'overbought' && !(r > 70)) return false;
  }

  // MA trend
  if (c.maTrend) {
    const prix = row.cours_jour;
    if (prix == null) return false;
    if (c.maTrend === 'above_ma20') {
      if (row.ma20 == null || prix <= row.ma20) return false;
    } else if (c.maTrend === 'above_ma50') {
      if (row.ma50 == null || prix <= row.ma50) return false;
    } else if (c.maTrend === 'above_ma200') {
      if (row.ma200 == null || prix <= row.ma200) return false;
    } else if (c.maTrend === 'above_ma20_50') {
      if (row.ma20 == null || prix <= row.ma20) return false;
      if (row.ma50 == null || prix <= row.ma50) return false;
    }
  }

  // MACD direction
  if (c.macdDir) {
    if (row.macd == null || row.macdSignal == null) return false;
    if (c.macdDir === 'bullish' && !(row.macd > row.macdSignal)) return false;
    if (c.macdDir === 'bearish' && !(row.macd < row.macdSignal)) return false;
  }

  // Volume ratio vs 20-day average
  if (c.volumeRatio != null) {
    if (row.volume == null || row.volumeAvg20 == null || row.volumeAvg20 === 0) return false;
    if (!(row.volume >= c.volumeRatio * row.volumeAvg20)) return false;
  }

  // Variation direction
  if (c.variationDir) {
    const v = row.variation_pct;
    if (v == null) return false;
    if (c.variationDir === 'up_2' && !(v > 2)) return false;
    if (c.variationDir === 'up_5' && !(v > 5)) return false;
    if (c.variationDir === 'down_2' && !(v < -2)) return false;
    if (c.variationDir === 'down_5' && !(v < -5)) return false;
  }

  // Secteur
  if (c.secteur && row.secteur !== c.secteur) return false;

  return true;
}

export function parseCriteriaFromSearchParams(
  sp: Record<string, string | undefined>,
): ScannerCriteria {
  const c: ScannerCriteria = {};

  if (sp.signal === 'BUY' || sp.signal === 'HOLD' || sp.signal === 'SELL') {
    c.signal = sp.signal;
  }

  if (
    sp.rsiBucket === 'oversold' ||
    sp.rsiBucket === 'low' ||
    sp.rsiBucket === 'mid' ||
    sp.rsiBucket === 'overbought'
  ) {
    c.rsiBucket = sp.rsiBucket;
  }

  if (
    sp.maTrend === 'above_ma20' ||
    sp.maTrend === 'above_ma50' ||
    sp.maTrend === 'above_ma200' ||
    sp.maTrend === 'above_ma20_50'
  ) {
    c.maTrend = sp.maTrend;
  }

  if (sp.macdDir === 'bullish' || sp.macdDir === 'bearish') {
    c.macdDir = sp.macdDir;
  }

  if (sp.volumeRatio === '2') c.volumeRatio = 2;
  else if (sp.volumeRatio === '5') c.volumeRatio = 5;

  if (
    sp.variationDir === 'up_2' ||
    sp.variationDir === 'up_5' ||
    sp.variationDir === 'down_2' ||
    sp.variationDir === 'down_5'
  ) {
    c.variationDir = sp.variationDir;
  }

  if (sp.secteur && sp.secteur !== '') c.secteur = sp.secteur;

  return c;
}

/** Returns true if at least one criterion is set (i.e. the form was submitted with filters). */
export function hasAnyCriteria(c: ScannerCriteria): boolean {
  return Object.values(c).some((v) => v != null);
}
