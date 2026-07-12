/**
 * Signaux intraday adaptés à un MARCHÉ DE FIXING (la BRVM).
 *
 * Pourquoi ce module remplace ATR + consolidation (diagnostic 2026-07-12) :
 * la BRVM n'est pas un marché continu. Constat sur la séance du 2026-07-10
 * (47 titres, 1000 snapshots) : le titre le plus actif n'a connu que
 * 7 prix distincts dans la journée, et SNTS — la valeur la plus liquide — n'a
 * bougé que de 0,32 % entre 4 prix. Le cron capturant toutes les 15 minutes,
 * chaque bougie de 15 min ne contient qu'UN point : open = high = low = close.
 * L'amplitude vraie est donc NULLE, et l'ATR (true range) comme la consolidation
 * (ratio corps/amplitude) n'ont mathématiquement rien à mesurer — d'où 0 pattern
 * détecté en production depuis la mise en place du cron.
 *
 * Ce module mesure à la place ce qui est RÉELLEMENT observable ici :
 *   1. price_move        — le prix a bougé (c'est rare, donc c'est un signal) ;
 *   2. volume_spike      — volume du jour anormal vs sa moyenne 20 séances ;
 *   3. intraday_momentum — direction et ampleur depuis l'ouverture.
 *
 * Fonctions pures, testées (tests/fixingSignals.test.ts). Aucune valeur inventée :
 * un signal n'est émis que si la donnée nécessaire existe.
 */

/** Un relevé intraday : la BRVM ne publie qu'un cours et un volume cumulé. */
export interface IntradaySample {
  close: number;
  volume: number;
}

export type FixingSignalType = 'price_move' | 'volume_spike' | 'intraday_momentum';

export interface FixingSignal {
  type: FixingSignalType;
  /** Valeur mesurée (signée pour les signaux directionnels). */
  value: number;
  /** Seuil de déclenchement retenu. */
  threshold: number;
  triggered: boolean;
}

export interface PriceMoveResult extends FixingSignal {
  type: 'price_move';
  /** Nombre de prix distincts de la séance — l'indicateur d'activité du titre. */
  distinctPrices: number;
}

/**
 * Seuils CALIBRÉS sur la séance réelle du 2026-07-10 (47 titres), et non devinés.
 * La variation quotidienne est plafonnée à ±7,5 % à la BRVM.
 *
 *   momentum ≥ 3 %  → 13/47 titres (27 %)  : mouvement réellement notable
 *   volume   ≥ 2×   →  3/47 titres ( 6 %)  : activité anormale, très sélectif
 *
 * NB : un seuil de momentum à 0,5 % signalait 35/47 titres (74 %) — un screener
 * qui signale les trois quarts de la cote ne sert à rien.
 */
export const FIXING_THRESHOLDS = {
  /** Multiple de la moyenne de volume 20 j à partir duquel le volume est anormal. */
  volumeSpikeRatio: 2.0,
  /** Momentum (%) depuis l'ouverture au-delà duquel la direction est nette. */
  momentumPct: 3.0,
} as const;

/**
 * 1) Le prix a-t-il bougé ? Sur un marché où la plupart des titres restent figés
 * toute la séance, un simple mouvement est en soi une information.
 * `value` = amplitude signée entre le premier et le dernier cours (%).
 */
/**
 * Amplitude signée de la séance. N'est PLUS un signal émis (elle est identique
 * au momentum sur ce marché — cf. detectFixingSignals), mais reste exposée
 * comme mesure de contexte et testée.
 */
export function detectPriceMove(
  samples: IntradaySample[],
  thresholdPct: number = FIXING_THRESHOLDS.momentumPct,
): PriceMoveResult {
  const closes = samples.map((s) => s.close).filter((c) => c > 0);
  const base: PriceMoveResult = {
    type: 'price_move',
    value: 0,
    threshold: thresholdPct,
    triggered: false,
    distinctPrices: new Set(closes).size,
  };
  if (closes.length < 2) return base;

  const first = closes[0]!;
  const last = closes[closes.length - 1]!;
  const pct = ((last - first) / first) * 100;
  return { ...base, value: pct, triggered: Math.abs(pct) >= thresholdPct };
}

/**
 * Volume RÉEL de la séance à partir de snapshots dont le champ `volume` est
 * CUMULÉ (constat sur données réelles : 566 → 605 → 703 → 713 → 739…).
 *
 * Deux pièges, tous deux vérifiés sur la séance du 2026-07-10 :
 *  - **sommer** les snapshots multiplie le volume par leur nombre (~20×) ;
 *  - la **première capture (~09:01) porte le volume de la VEILLE** (avant le
 *    reset d'ouverture à 0) — prendre le `max` global le confondrait avec le
 *    volume du jour (SNTS : 14 206 la veille contre 739 réellement échangés).
 *
 * Règle correcte : on repère le dernier RESET (une valeur inférieure à la
 * précédente = nouvelle séance) et on prend le maximum du segment qui suit.
 */
export function sessionVolumeFromCumulative(samples: IntradaySample[]): number {
  const vols = samples.map((s) => (Number.isFinite(s.volume) ? s.volume : 0));
  if (vols.length === 0) return 0;

  let segmentStart = 0;
  for (let i = 1; i < vols.length; i++) {
    if (vols[i]! < vols[i - 1]!) segmentStart = i; // reset → début de la séance
  }
  return Math.max(...vols.slice(segmentStart), 0);
}

/**
 * 2) Le volume du jour est-il anormal ? `avgVolume20d` vient de l'historique
 * quotidien. Sans moyenne connue, aucun signal (pas de ratio fantaisiste).
 */
export function detectVolumeSpike(
  samples: IntradaySample[],
  avgVolume20d: number | null,
  thresholdRatio: number = FIXING_THRESHOLDS.volumeSpikeRatio,
): FixingSignal {
  const total = sessionVolumeFromCumulative(samples);
  const base: FixingSignal = {
    type: 'volume_spike',
    value: 0,
    threshold: thresholdRatio,
    triggered: false,
  };
  if (!avgVolume20d || avgVolume20d <= 0 || total <= 0) return base;

  const ratio = total / avgVolume20d;
  return { ...base, value: ratio, triggered: ratio >= thresholdRatio };
}

/**
 * 3) Momentum depuis l'ouverture — signé : une baisse nette est un signal
 * aussi utile qu'une hausse.
 */
export function detectIntradayMomentum(
  samples: IntradaySample[],
  thresholdPct: number = FIXING_THRESHOLDS.momentumPct,
): FixingSignal {
  const closes = samples.map((s) => s.close).filter((c) => c > 0);
  const base: FixingSignal = {
    type: 'intraday_momentum',
    value: 0,
    threshold: thresholdPct,
    triggered: false,
  };
  if (closes.length < 2) return base;

  const open = closes[0]!;
  const last = closes[closes.length - 1]!;
  const pct = ((last - open) / open) * 100;
  return { ...base, value: pct, triggered: Math.abs(pct) >= thresholdPct };
}

/**
 * Orchestration : ne renvoie QUE les signaux déclenchés.
 *
 * Deux signaux seulement — et c'est délibéré. Une mesure d'« amplitude
 * parcourue » a été écartée après calibration : sur les données réelles, elle
 * est IDENTIQUE au momentum pour la quasi-totalité des titres (CBIBF, UNXC,
 * BOAN : écart de 0,00 point), parce qu'avec 4 à 7 prix par séance un titre ne
 * « serpente » pas — il monte ou il descend. Deux signaux mesurant le même
 * phénomène auraient donné une fausse impression de richesse d'analyse.
 *
 * La valeur réelle est dans la CONFLUENCE : bouger AVEC un volume anormal =
 * conviction ; bouger sans volume = simple illiquidité. Sur la séance du
 * 2026-07-10, seuls ETIT et LNBB réunissaient les deux.
 */
export function detectFixingSignals(
  samples: IntradaySample[],
  ctx: { avgVolume20d: number | null },
): FixingSignal[] {
  const signals: FixingSignal[] = [
    detectVolumeSpike(samples, ctx.avgVolume20d),
    detectIntradayMomentum(samples),
  ];
  return signals.filter((s) => s.triggered);
}

/** Contexte d'activité d'un titre (métadonnée, pas un signal). */
export function sessionActivity(samples: IntradaySample[]): {
  distinctPrices: number;
  sessionVolume: number;
} {
  const closes = samples.map((s) => s.close).filter((c) => c > 0);
  return {
    distinctPrices: new Set(closes).size,
    sessionVolume: sessionVolumeFromCumulative(samples),
  };
}
