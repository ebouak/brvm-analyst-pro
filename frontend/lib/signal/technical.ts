/**
 * Lecture technique d'un signal : traduit les sous-scores / indicateurs en
 * langage clair et **assume les tensions** entre indicateurs (ex. RSI vendeur
 * en tendance haussière) au lieu d'empiler des facteurs contradictoires.
 *
 * Fonction pure et testable — aucune dépendance I/O.
 */

export type SignalLabel = 'BUY' | 'HOLD' | 'SELL';

export interface TechnicalInputs {
  signal: SignalLabel;
  rsi: number | null;
  ma20: number | null;
  ma50: number | null;
  volumeRatio: number | null;
  variationPct: number | null;
  incomplet?: boolean;
}

export interface TechnicalReading {
  headline: string;
  tone: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  points: string[];
  tension: string | null;
}

export function readTechnical(t: TechnicalInputs): TechnicalReading {
  const trendUp = t.ma20 != null && t.ma50 != null && t.ma20 > t.ma50;
  const trendDown = t.ma20 != null && t.ma50 != null && t.ma20 < t.ma50;
  const overbought = t.rsi != null && t.rsi > 70;
  const oversold = t.rsi != null && t.rsi < 30;

  const points: string[] = [];

  if (t.rsi != null) {
    if (overbought) points.push(`RSI ${t.rsi.toFixed(0)} — surachat : prudence, risque de correction court terme.`);
    else if (oversold) points.push(`RSI ${t.rsi.toFixed(0)} — survente : rebond technique possible.`);
    else points.push(`RSI ${t.rsi.toFixed(0)} — zone neutre, pas d'excès.`);
  }

  if (t.volumeRatio != null) {
    if (t.volumeRatio > 1.5) points.push(`Volume ${t.volumeRatio.toFixed(1)}× la moyenne — activité anormale, mouvement à surveiller.`);
    else if (t.volumeRatio < 0.5) points.push(`Volume faible (${t.volumeRatio.toFixed(1)}× la moyenne) — peu de conviction derrière le mouvement.`);
    else points.push(`Volume proche de la moyenne — activité ordinaire.`);
  }

  if (trendUp) points.push('MA20 au-dessus de MA50 — tendance de fond haussière.');
  else if (trendDown) points.push('MA20 sous MA50 — tendance de fond baissière.');

  if (t.variationPct != null && Math.abs(t.variationPct) >= 3) {
    const sens = t.variationPct > 0 ? 'hausse' : 'baisse';
    points.push(`Forte ${sens} du jour (${t.variationPct > 0 ? '+' : ''}${t.variationPct.toFixed(1)}%).`);
  }

  // Détection de tension entre court terme (RSI / signal) et fond (tendance MA)
  let tension: string | null = null;
  if ((overbought || t.signal === 'SELL') && trendUp) {
    tension =
      'Signal vendeur de court terme (surachat) mais tendance de fond haussière : ' +
      'plutôt une correction technique qu\'un retournement de fond.';
  } else if ((oversold || t.signal === 'BUY') && trendDown) {
    tension =
      'Signal acheteur de court terme (survente) mais tendance de fond baissière : ' +
      'un rebond est possible sans garantie de retournement.';
  }

  let tone: TechnicalReading['tone'];
  if (tension) tone = 'mixed';
  else if (t.signal === 'BUY') tone = 'bullish';
  else if (t.signal === 'SELL') tone = 'bearish';
  else tone = 'neutral';

  let headline: string;
  if (tone === 'mixed') {
    if (overbought && trendUp) headline = 'Surachat en tendance haussière';
    else if (oversold && trendDown) headline = 'Survente en tendance baissière';
    else headline = 'Signaux divergents';
  } else if (tone === 'bullish') {
    headline = 'Configuration acheteuse';
  } else if (tone === 'bearish') {
    headline = 'Configuration vendeuse';
  } else {
    headline = 'Pas de signal franc';
  }

  return { headline, tone, points, tension };
}
