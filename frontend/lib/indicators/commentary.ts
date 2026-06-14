/**
 * Lecture automatique des indicateurs techniques en langage clair.
 * Transforme les dernières valeurs (RSI, MACD, moyennes mobiles) en commentaires
 * lisibles pour l'utilisateur. Fonction pure et testable.
 */

export interface IndicatorInputs {
  rsi: number | null;
  macd: number | null;        // ligne MACD (ou histogramme) du jour
  ma20: number | null;
  ma50: number | null;
}

export interface IndicatorReading {
  points: string[];
  tone: 'haussier' | 'baissier' | 'mixte' | 'neutre';
}

export function readIndicators(i: IndicatorInputs): IndicatorReading {
  const points: string[] = [];
  let bull = 0, bear = 0;

  if (i.rsi != null) {
    if (i.rsi > 70) { points.push(`RSI ${i.rsi.toFixed(0)} : surachat — l'action est tendue à la hausse, prudence sur une correction possible.`); bear++; }
    else if (i.rsi < 30) { points.push(`RSI ${i.rsi.toFixed(0)} : survente — rebond technique possible, point d'entrée à surveiller.`); bull++; }
    else points.push(`RSI ${i.rsi.toFixed(0)} : zone neutre, pas d'excès marqué.`);
  }

  if (i.macd != null) {
    if (i.macd > 0) { points.push(`MACD positif : momentum orienté à la hausse.`); bull++; }
    else if (i.macd < 0) { points.push(`MACD négatif : momentum orienté à la baisse.`); bear++; }
    else points.push(`MACD proche de zéro : momentum indécis.`);
  }

  if (i.ma20 != null && i.ma50 != null) {
    if (i.ma20 > i.ma50) { points.push(`MA20 au-dessus de MA50 : tendance de fond haussière.`); bull++; }
    else if (i.ma20 < i.ma50) { points.push(`MA20 sous MA50 : tendance de fond baissière.`); bear++; }
  }

  let tone: IndicatorReading['tone'] = 'neutre';
  if (bull > 0 && bear > 0) tone = 'mixte';
  else if (bull > bear) tone = 'haussier';
  else if (bear > bull) tone = 'baissier';

  return { points, tone };
}
