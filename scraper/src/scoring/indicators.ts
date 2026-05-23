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

/** Borne une valeur dans [min, max]. */
export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
