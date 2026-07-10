/**
 * Algorithme de scoring d'opportunité (cf. §9 + §6.7 explicabilité).
 *
 * Formule de base :
 *   score = 0.3*variation_norm + 0.4*volume_signal + 0.3*rsi_signal
 *           + bonus_tendance - penalite_liquidite
 *
 * Chaque sous-score est borné dans [-1, 1] pour que le composite reste
 * interprétable. Les améliorations demandées sont intégrées :
 *   - plafonnement des outliers (VAR_CAP) ;
 *   - lissage logarithmique du ratio de volume ;
 *   - bonus si tendance haussière (MA20 > MA50) ;
 *   - pénalité de faible liquidité ;
 *   - neutralisation (HOLD, confiance basse) si données incomplètes.
 *
 * Règles de décision :
 *   BUY  si score >  0.6
 *   SELL si score < -0.6
 *   HOLD sinon
 */
import { sma, rsi, macd, clamp } from './indicators.js';

/** Pondérations et paramètres (centralisés pour calibrage facile). */
export const SCORING_PARAMS = {
  // Pondérations (somme = 1). Le MACD (momentum de fond) rejoint la variation
  // du jour, le volume et le RSI (mean-reversion, désormais pondéré par le régime).
  W_VARIATION: 0.25,
  W_VOLUME: 0.25,
  W_RSI: 0.3,
  W_MACD: 0.2,
  /** Variation (%) au-delà de laquelle on plafonne la contribution. */
  VAR_CAP_PCT: 5,
  /** RSI : amplitude autour de 50 pour saturer le sous-score (mean reversion). */
  RSI_BAND: 20,
  /** MACD : histogramme (en % du cours) saturant le sous-score momentum. */
  MACD_BAND_PCT: 1,
  /** Écart MA20/MA50 (en %) correspondant à une tendance « pleine » (régime). */
  TREND_BAND_PCT: 3,
  /** Volume moyen 30j en dessous duquel on applique une pénalité de liquidité. */
  MIN_LIQUIDITY_AVG_VOLUME: 100,
  /** Valeur max de la pénalité de liquidité. */
  PENALITE_LIQUIDITE_MAX: 0.25,
  /** Amplitude du facteur de tendance, désormais SYMÉTRIQUE (±) selon MA20 vs MA50. */
  BONUS_TENDANCE: 0.1,
  BUY_THRESHOLD: 0.6,
  SELL_THRESHOLD: -0.6,
  /** Nb minimum de points d'historique pour ne pas neutraliser le signal.
   * 5 jours suffisent pour variation+volume ; RSI et SMA50 resteront partiels. */
  MIN_HISTORY: 5,
} as const;

export type SignalLabel = 'BUY' | 'HOLD' | 'SELL';

/** Entrées de calcul pour un instrument. */
export interface ScoreInput {
  code: string;
  /** Cours de clôture du plus ancien au plus récent (séance courante incluse). */
  closes: number[];
  /** Variation (%) de la séance courante. */
  variation_pct: number | null;
  /** Volume de la séance courante. */
  volume: number | null;
  /** Volume moyen 30j (mv_volume_avg_30d). */
  avg_volume_30d: number | null;
}

/** Résultat détaillé et explicable d'un scoring. */
export interface ScoreResult {
  code: string;
  signal: SignalLabel;
  score_total: number;
  score_variation: number | null;
  score_volume: number | null;
  score_rsi: number | null;
  score_macd: number | null;
  bonus_tendance: number;
  penalite_liquidite: number;
  confiance: number;
  explication: string;
  inputs: {
    variation_pct: number | null;
    volume: number | null;
    avg_volume_30d: number | null;
    volume_ratio: number | null;
    rsi: number | null;
    macd_line: number | null;
    macd_signal: number | null;
    macd_histogram: number | null;
    ma20: number | null;
    ma50: number | null;
    trend_norm: number;
    rsi_regime_weight: number;
    history_len: number;
    incomplet: boolean;
  };
}

export function computeScore(input: ScoreInput): ScoreResult {
  const P = SCORING_PARAMS;
  const histLen = input.closes.length;

  // --- Indicateurs ---------------------------------------------------------
  const rsiVal = rsi(input.closes, 14);
  const ma20 = sma(input.closes, 20);
  const ma50 = sma(input.closes, 50);
  const macdVal = macd(input.closes);
  const lastClose = histLen > 0 ? input.closes[histLen - 1]! : null;

  // --- Régime de marché : force et sens de la tendance (MA20 vs MA50) -------
  // trendNorm ∈ [-1, 1] : +1 = tendance haussière « pleine », -1 = baissière.
  let trendNorm = 0;
  if (ma20 != null && ma50 != null && ma50 !== 0) {
    trendNorm = clamp(((ma20 - ma50) / ma50) / (P.TREND_BAND_PCT / 100), -1, 1);
  }
  // En tendance marquée, la mean-reversion (RSI) est atténuée (un RSI haut en
  // pleine hausse n'est pas un signal de vente) → poids RSI = 1 - |trendNorm|.
  const rsiRegimeWeight = 1 - Math.abs(trendNorm);

  // --- Sous-score variation (momentum du jour, plafonné) -------------------
  let scoreVariation: number | null = null;
  if (input.variation_pct != null) {
    scoreVariation = clamp(input.variation_pct / P.VAR_CAP_PCT, -1, 1);
  }

  // --- Sous-score volume (confirmation directionnelle, lissée) -------------
  // volume_ratio = volume / moyenne 30j ; lissé en log pour écraser les pics.
  // Le signe suit la direction du jour : un volume élevé renforce le sens de
  // la variation ; un volume faible le tempère.
  let volumeRatio: number | null = null;
  let scoreVolume: number | null = null;
  if (input.volume != null && input.avg_volume_30d != null && input.avg_volume_30d > 0) {
    volumeRatio = input.volume / input.avg_volume_30d;
    const magnitude = clamp(Math.tanh(Math.log(volumeRatio + 1e-9)), -1, 1);
    const dir = Math.sign(input.variation_pct ?? 0);
    scoreVolume = dir === 0 ? 0 : clamp(Math.abs(magnitude) * dir, -1, 1);
  }

  // --- Sous-score MACD (momentum de fond) ----------------------------------
  // Histogramme (MACD − signal) normalisé en % du cours : positif = momentum
  // haussier, négatif = baissier. Confirme la variation du jour côté tendance.
  let scoreMacd: number | null = null;
  if (macdVal != null && lastClose != null && lastClose > 0) {
    const histPct = (macdVal.histogram / lastClose) / (P.MACD_BAND_PCT / 100);
    scoreMacd = clamp(Math.tanh(histPct), -1, 1);
  }

  // --- Sous-score RSI (mean reversion : survente => achat) ------------------
  let scoreRsi: number | null = null;
  if (rsiVal != null) {
    scoreRsi = clamp((50 - rsiVal) / P.RSI_BAND, -1, 1);
  }

  // --- Facteur de tendance SYMÉTRIQUE (±) selon le régime -------------------
  // +BONUS en tendance haussière, −BONUS en baissière (plus de biais acheteur).
  const bonusTendance = trendNorm * P.BONUS_TENDANCE;

  // --- Pénalité de faible liquidité ----------------------------------------
  let penaliteLiquidite = 0;
  if (input.avg_volume_30d != null && input.avg_volume_30d < P.MIN_LIQUIDITY_AVG_VOLUME) {
    const deficit = 1 - input.avg_volume_30d / P.MIN_LIQUIDITY_AVG_VOLUME;
    penaliteLiquidite = clamp(deficit, 0, 1) * P.PENALITE_LIQUIDITE_MAX;
  }

  // --- Composite (les sous-scores manquants comptent 0) --------------------
  const vVar = scoreVariation ?? 0;
  const vVol = scoreVolume ?? 0;
  const vMacd = scoreMacd ?? 0;
  const vRsi = (scoreRsi ?? 0) * rsiRegimeWeight; // RSI atténué par le régime
  let scoreTotal =
    P.W_VARIATION * vVar +
    P.W_VOLUME * vVol +
    P.W_MACD * vMacd +
    P.W_RSI * vRsi +
    bonusTendance -
    penaliteLiquidite;
  scoreTotal = clamp(scoreTotal, -1, 1);

  // --- Neutralisation si données incomplètes (§9) --------------------------
  const incomplet =
    histLen < P.MIN_HISTORY ||
    input.variation_pct == null ||
    rsiVal == null;

  // --- Décision ------------------------------------------------------------
  let signal: SignalLabel;
  if (incomplet) {
    signal = 'HOLD';
  } else if (scoreTotal > P.BUY_THRESHOLD) {
    signal = 'BUY';
  } else if (scoreTotal < P.SELL_THRESHOLD) {
    signal = 'SELL';
  } else {
    signal = 'HOLD';
  }

  // --- Confiance : complétude + richesse d'historique + NETTETÉ AU SEUIL -----
  // La netteté mesure la distance à la frontière de décision (pas à zéro) : un
  // BUY à 0,61 (marginal) est peu net ; un BUY à 0,95 l'est beaucoup ; un HOLD
  // central (score≈0) est un HOLD franc, un HOLD à 0,59 est incertain.
  const presence =
    (scoreVariation != null ? 1 : 0) +
    (scoreVolume != null ? 1 : 0) +
    (scoreRsi != null ? 1 : 0) +
    (scoreMacd != null ? 1 : 0);
  const completude = presence / 4;
  const histFactor = clamp(histLen / 50, 0, 1); // 50j => historique riche
  let nettete: number;
  if (signal === 'BUY') {
    nettete = clamp((scoreTotal - P.BUY_THRESHOLD) / (1 - P.BUY_THRESHOLD), 0, 1);
  } else if (signal === 'SELL') {
    nettete = clamp((P.SELL_THRESHOLD - scoreTotal) / (1 + P.SELL_THRESHOLD), 0, 1);
  } else {
    // HOLD : d'autant plus franc que le score est loin des DEUX seuils.
    const marge = Math.min(P.BUY_THRESHOLD - scoreTotal, scoreTotal - P.SELL_THRESHOLD);
    nettete = clamp(marge / P.BUY_THRESHOLD, 0, 1);
  }
  let confiance = clamp(0.5 * completude + 0.3 * histFactor + 0.2 * nettete, 0, 1);
  if (incomplet) confiance = Math.min(confiance, 0.3);

  const explication = buildExplanation({
    signal,
    incomplet,
    scoreVariation,
    scoreVolume,
    scoreRsi,
    rsiVal,
    volumeRatio,
    macdHistogram: macdVal?.histogram ?? null,
    bonusTendance,
    penaliteLiquidite,
    trendUp: trendNorm > 0.15,
    trendDown: trendNorm < -0.15,
  });

  return {
    code: input.code,
    signal,
    score_total: round4(scoreTotal),
    score_variation: scoreVariation == null ? null : round4(scoreVariation),
    score_volume: scoreVolume == null ? null : round4(scoreVolume),
    score_rsi: scoreRsi == null ? null : round4(scoreRsi),
    score_macd: scoreMacd == null ? null : round4(scoreMacd),
    bonus_tendance: round4(bonusTendance),
    penalite_liquidite: round4(penaliteLiquidite),
    confiance: round4(confiance),
    explication,
    inputs: {
      variation_pct: input.variation_pct,
      volume: input.volume,
      avg_volume_30d: input.avg_volume_30d,
      volume_ratio: volumeRatio == null ? null : round4(volumeRatio),
      rsi: rsiVal == null ? null : round4(rsiVal),
      macd_line: macdVal == null ? null : round4(macdVal.line),
      macd_signal: macdVal == null ? null : round4(macdVal.signal),
      macd_histogram: macdVal == null ? null : round4(macdVal.histogram),
      ma20: ma20 == null ? null : round4(ma20),
      ma50: ma50 == null ? null : round4(ma50),
      trend_norm: round4(trendNorm),
      rsi_regime_weight: round4(rsiRegimeWeight),
      history_len: histLen,
      incomplet,
    },
  };
}

function buildExplanation(a: {
  signal: SignalLabel;
  incomplet: boolean;
  scoreVariation: number | null;
  scoreVolume: number | null;
  scoreRsi: number | null;
  rsiVal: number | null;
  volumeRatio: number | null;
  macdHistogram: number | null;
  bonusTendance: number;
  penaliteLiquidite: number;
  trendUp: boolean;
  trendDown: boolean;
}): string {
  if (a.incomplet) {
    return (
      'Signal neutralisé (HOLD) : données ou historique insuffisants pour ' +
      'un calcul fiable. Plus de séances historisées sont nécessaires.'
    );
  }
  const parts: string[] = [];
  if (a.rsiVal != null) {
    if (a.rsiVal < 30) parts.push(`RSI ${a.rsiVal.toFixed(0)} (survente, signal acheteur)`);
    else if (a.rsiVal > 70) parts.push(`RSI ${a.rsiVal.toFixed(0)} (surachat, signal vendeur)`);
    else parts.push(`RSI ${a.rsiVal.toFixed(0)} (neutre)`);
  }
  if (a.volumeRatio != null) {
    if (a.volumeRatio > 1.5) parts.push(`volume ${a.volumeRatio.toFixed(1)}x la moyenne (activité anormale)`);
    else if (a.volumeRatio < 0.5) parts.push(`volume faible (${a.volumeRatio.toFixed(1)}x la moyenne)`);
    else parts.push(`volume proche de la moyenne`);
  }
  if (a.macdHistogram != null) {
    if (a.macdHistogram > 0) parts.push('MACD positif (momentum de fond haussier)');
    else if (a.macdHistogram < 0) parts.push('MACD négatif (momentum de fond baissier)');
  }
  if (a.bonusTendance > 0.001) parts.push('tendance de fond haussière (MA20 > MA50)');
  else if (a.bonusTendance < -0.001) parts.push('tendance de fond baissière (MA20 < MA50)');
  if (a.penaliteLiquidite > 0) parts.push('pénalité de faible liquidité appliquée');

  const intro =
    a.signal === 'BUY'
      ? 'Opportunité acheteuse'
      : a.signal === 'SELL'
        ? 'Signal vendeur'
        : 'Pas de signal franc (HOLD)';

  // Clause de tension : court terme vs tendance de fond divergents.
  let tension = '';
  if (a.signal === 'SELL' && a.trendUp) {
    tension = ' À nuancer : la tendance de fond reste haussière (MA20 > MA50) — plutôt une correction technique qu\'un retournement.';
  } else if (a.signal === 'BUY' && a.trendDown) {
    tension = ' À nuancer : la tendance de fond reste baissière (MA20 < MA50) — un rebond est possible sans garantie de retournement.';
  }

  return `${intro}. Facteurs : ${parts.join(' ; ')}.${tension}`;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
