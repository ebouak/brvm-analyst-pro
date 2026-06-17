// frontend/lib/technicalSummary.ts
// Logique pure — aucun import React, aucun fetch.

export type SignalDirection = 'up' | 'down' | 'neutral' | 'na';

export interface TechnicalSignal {
  id: 'ma20' | 'macd' | 'dmi' | 'bb' | 'rsi' | 'stoch' | 'cci';
  label: string;
  direction: SignalDirection;
  value: number | null;
  detail: string;
}

export interface TechnicalSummaryResult {
  signals: TechnicalSignal[];
  trend: 'hausse' | 'baisse' | 'neutre';
  confidence: number; // 0–100
  bullCount: number;
  bearCount: number;
  neutCount: number;
}

export interface TechnicalSummaryParams {
  lastClose: number | null;
  ma20Last: number | null;
  macdVal: number | null;
  macdSignal: number | null;
  rsiVal: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  stochK: number | null;
  cci: number | null;
  // DMI — null = données H/L manquantes (affiché N/A)
  dmiPlus: number | null;
  dmiMinus: number | null;
}

function phrase(id: TechnicalSignal['id'], direction: SignalDirection, value: number | null): string {
  const v = value != null ? value.toFixed(2) : '—';
  switch (id) {
    case 'ma20':
      return direction === 'up'
        ? 'Le cours est au-dessus de la moyenne mobile à 20 jours'
        : direction === 'down'
        ? 'Le cours est sous la moyenne mobile à 20 jours'
        : 'Le cours évolue autour de la moyenne mobile à 20 jours';
    case 'macd':
      return direction === 'up'
        ? 'La MACD évolue au-dessus de sa ligne de signal'
        : direction === 'down'
        ? 'La MACD évolue en dessous de sa ligne de signal'
        : 'La MACD est proche de sa ligne de signal';
    case 'dmi':
      if (direction === 'na') return '+DI/-DI indisponibles (données OHLCV manquantes)';
      return direction === 'up'
        ? `+DI (${v}) est au-dessus de -DI : tendance haussière`
        : direction === 'down'
        ? `-DI est au-dessus de +DI : tendance baissière`
        : '+DI et -DI sont proches : la tendance est neutre';
    case 'bb':
      return direction === 'up'
        ? 'Les cours évoluent au-dessus de la bande supérieure de Bollinger'
        : direction === 'down'
        ? 'Les cours évoluent sous la bande inférieure de Bollinger'
        : 'Les cours évoluent dans les bandes de Bollinger';
    case 'rsi':
      return direction === 'up'
        ? `RSI 14j est à ${v} — zone de survente (opportunité)`
        : direction === 'down'
        ? `RSI 14j est à ${v} — zone de surachat (prudence)`
        : `RSI 14j est à ${v} — zone neutre`;
    case 'stoch':
      return direction === 'up'
        ? `Le Stochastique %K est à ${v} — zone de survente`
        : direction === 'down'
        ? `Le Stochastique %K est à ${v} — zone de surachat`
        : `Le Stochastique %K est à ${v} — zone neutre`;
    case 'cci':
      return direction === 'up'
        ? `CCI 20 est à ${v} — momentum positif`
        : direction === 'down'
        ? `CCI 20 est à ${v} — momentum négatif`
        : `CCI 20 est à ${v} — zone neutre`;
    default:
      throw new Error(`Unknown signal id: ${id as string}`);
  }
}

export function computeTechnicalSummary(p: TechnicalSummaryParams): TechnicalSummaryResult {
  const signals: TechnicalSignal[] = [];

  // MA20
  {
    const dir: SignalDirection =
      p.lastClose == null || p.ma20Last == null ? 'na'
      : p.lastClose > p.ma20Last ? 'up'
      : p.lastClose < p.ma20Last ? 'down'
      : 'neutral';
    signals.push({ id: 'ma20', label: 'MA20', direction: dir, value: p.ma20Last, detail: phrase('ma20', dir, p.ma20Last) });
  }

  // MACD
  {
    const dir: SignalDirection =
      p.macdVal == null || p.macdSignal == null ? 'na'
      : p.macdVal > p.macdSignal ? 'up'
      : p.macdVal < p.macdSignal ? 'down'
      : 'neutral';
    const diff = p.macdVal != null && p.macdSignal != null ? p.macdVal - p.macdSignal : null;
    signals.push({ id: 'macd', label: 'MACD', direction: dir, value: diff, detail: phrase('macd', dir, diff) });
  }

  // DMI
  {
    const dir: SignalDirection =
      p.dmiPlus == null || p.dmiMinus == null ? 'na'
      : p.dmiPlus > p.dmiMinus ? 'up'
      : p.dmiPlus < p.dmiMinus ? 'down'
      : 'neutral';
    signals.push({ id: 'dmi', label: 'DMI', direction: dir, value: p.dmiPlus, detail: phrase('dmi', dir, p.dmiPlus) });
  }

  // Bollinger
  {
    const dir: SignalDirection =
      p.lastClose == null || p.bbUpper == null || p.bbLower == null ? 'na'
      : p.lastClose > p.bbUpper ? 'up'
      : p.lastClose < p.bbLower ? 'down'
      : 'neutral';
    signals.push({ id: 'bb', label: 'Bollinger', direction: dir, value: p.bbUpper, detail: phrase('bb', dir, p.bbUpper) });
  }

  // RSI — convention : survente (<30) = signal UP (opportunité d'achat)
  {
    const dir: SignalDirection =
      p.rsiVal == null ? 'na'
      : p.rsiVal < 30 ? 'up'
      : p.rsiVal > 70 ? 'down'
      : 'neutral';
    signals.push({ id: 'rsi', label: 'RSI(14)', direction: dir, value: p.rsiVal, detail: phrase('rsi', dir, p.rsiVal) });
  }

  // Stochastique
  {
    const dir: SignalDirection =
      p.stochK == null ? 'na'
      : p.stochK < 20 ? 'up'
      : p.stochK > 80 ? 'down'
      : 'neutral';
    signals.push({ id: 'stoch', label: 'Stochastique', direction: dir, value: p.stochK, detail: phrase('stoch', dir, p.stochK) });
  }

  // CCI — >100 = momentum positif (up), <-100 = momentum négatif (down)
  {
    const dir: SignalDirection =
      p.cci == null ? 'na'
      : p.cci > 100 ? 'up'
      : p.cci < -100 ? 'down'
      : 'neutral';
    signals.push({ id: 'cci', label: 'CCI(20)', direction: dir, value: p.cci, detail: phrase('cci', dir, p.cci) });
  }

  // Comptage (exclu 'na')
  const valid = signals.filter((s) => s.direction !== 'na');
  const bullCount = valid.filter((s) => s.direction === 'up').length;
  const bearCount = valid.filter((s) => s.direction === 'down').length;
  const neutCount = valid.filter((s) => s.direction === 'neutral').length;

  const trend: TechnicalSummaryResult['trend'] =
    bullCount > bearCount ? 'hausse'
    : bearCount > bullCount ? 'baisse'
    : 'neutre';

  const confidence = valid.length > 0
    ? Math.round((Math.abs(bullCount - bearCount) / valid.length) * 100)
    : 0;

  return { signals, trend, confidence, bullCount, bearCount, neutCount };
}

// ── Verdict synthétique pour la jauge (type « speedomètre ») ────────────────
export type VerdictTone = 'strong-sell' | 'sell' | 'neutral' | 'buy' | 'strong-buy';

export interface TechnicalVerdict {
  label: string;      // libellé FR affiché
  tone: VerdictTone;  // pour le style
  position: number;   // 0 (vente forte) → 1 (achat fort), pour l'aiguille
  score: number;      // -1 → 1, balance haussiers/baissiers
}

/**
 * Dérive un verdict global (Vente forte … Achat fort) à partir du décompte des
 * signaux. Score = (haussiers - baissiers) / total des signaux valides, borné
 * à [-1, 1]. Honnête : si aucun signal valide, verdict neutre, aiguille au centre.
 */
export function technicalVerdict(
  r: Pick<TechnicalSummaryResult, 'bullCount' | 'bearCount' | 'neutCount'>,
): TechnicalVerdict {
  const total = r.bullCount + r.bearCount + r.neutCount;
  const score = total > 0 ? (r.bullCount - r.bearCount) / total : 0;
  const position = (score + 1) / 2;

  let tone: VerdictTone;
  let label: string;
  if (score <= -0.5) { tone = 'strong-sell'; label = 'Vente forte'; }
  else if (score < -0.15) { tone = 'sell'; label = 'Vente'; }
  else if (score <= 0.15) { tone = 'neutral'; label = 'Neutre'; }
  else if (score < 0.5) { tone = 'buy'; label = 'Achat'; }
  else { tone = 'strong-buy'; label = 'Achat fort'; }

  return { label, tone, position, score };
}
