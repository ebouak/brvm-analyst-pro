/**
 * Calibration des seuils du moteur « fixing » (intraday_momentum, volume_spike).
 *
 * Les seuils en vigueur (3 % / 2×) ont été calibrés sur UNE séance
 * (2026-07-10). Cet outil recalcule les mesures depuis la source brute
 * conservée (brvm_intraday_snapshots) sur N séances et montre, pour une grille
 * de seuils candidats, la part de la cote qui serait signalée — afin de valider
 * ou d'ajuster les seuils sur l'historique qui s'accumule.
 *
 * Fonctions pures (testées dans tests/calibrate.test.ts) ; l'IO vit dans
 * runCalibrate.ts. C'est ce qui remplace la table patterns_raw supprimée :
 * la trace brute se RECALCULE, elle ne se stocke pas en double.
 */
import { detectPriceMove, sessionVolumeFromCumulative, type IntradaySample } from './indicators/fixingSignals.js';

/** Mesures d'un titre sur une séance. */
export interface SessionMeasure {
  code: string;
  date: string;
  /** Variation signée ouverture → clôture (%), NaN si < 2 relevés. */
  momentumPct: number;
  /** Volume de séance / moyenne 20 j — null si moyenne inconnue. */
  volumeRatio: number | null;
}

/** Calcule les mesures d'une séance pour un titre. */
export function measureSession(
  code: string,
  date: string,
  samples: IntradaySample[],
  avgVolume20d: number | null,
): SessionMeasure | null {
  const move = detectPriceMove(samples, 0); // seuil 0 : on veut la mesure, pas le signal
  if (samples.length < 2) return null;
  const vol = sessionVolumeFromCumulative(samples);
  return {
    code,
    date,
    momentumPct: move.value,
    volumeRatio: avgVolume20d && avgVolume20d > 0 && vol > 0 ? vol / avgVolume20d : null,
  };
}

export interface ThresholdRow {
  threshold: number;
  /** Nombre de (titre, séance) déclenchés. */
  hits: number;
  /** Population évaluable (mesure disponible). */
  total: number;
  /** hits / total, en %. */
  ratePct: number;
}

/** Taux de déclenchement du momentum pour chaque seuil candidat. */
export function momentumGrid(measures: SessionMeasure[], thresholds: number[]): ThresholdRow[] {
  const evaluable = measures.filter((m) => Number.isFinite(m.momentumPct));
  return thresholds.map((t) => {
    const hits = evaluable.filter((m) => Math.abs(m.momentumPct) >= t).length;
    return { threshold: t, hits, total: evaluable.length, ratePct: evaluable.length ? (hits / evaluable.length) * 100 : 0 };
  });
}

/** Taux de déclenchement du volume pour chaque seuil candidat. */
export function volumeGrid(measures: SessionMeasure[], thresholds: number[]): ThresholdRow[] {
  const evaluable = measures.filter((m) => m.volumeRatio != null);
  return thresholds.map((t) => {
    const hits = evaluable.filter((m) => (m.volumeRatio as number) >= t).length;
    return { threshold: t, hits, total: evaluable.length, ratePct: evaluable.length ? (hits / evaluable.length) * 100 : 0 };
  });
}

/** (titre, séance) en CONFLUENCE — mouvement ET volume anormal — aux seuils donnés. */
export function confluences(
  measures: SessionMeasure[],
  momentumThreshold: number,
  volumeThreshold: number,
): SessionMeasure[] {
  return measures.filter(
    (m) =>
      Number.isFinite(m.momentumPct) &&
      Math.abs(m.momentumPct) >= momentumThreshold &&
      m.volumeRatio != null &&
      m.volumeRatio >= volumeThreshold,
  );
}

/** Rapport texte lisible en console. */
export function formatReport(
  measures: SessionMeasure[],
  opts: { momentumThresholds: number[]; volumeThresholds: number[]; currentMomentum: number; currentVolume: number },
): string {
  const sessions = new Set(measures.map((m) => m.date)).size;
  const lines: string[] = [];
  lines.push(`Calibration sur ${sessions} séance(s), ${measures.length} mesures (titre × séance).`);
  lines.push('');
  lines.push('Momentum — part de la cote signalée par seuil :');
  for (const r of momentumGrid(measures, opts.momentumThresholds)) {
    const marker = r.threshold === opts.currentMomentum ? '  ← seuil actuel' : '';
    lines.push(`  ≥ ${r.threshold.toFixed(1)} %  : ${r.hits}/${r.total} (${r.ratePct.toFixed(0)} %)${marker}`);
  }
  lines.push('');
  lines.push('Volume — part de la cote signalée par seuil :');
  for (const r of volumeGrid(measures, opts.volumeThresholds)) {
    const marker = r.threshold === opts.currentVolume ? '  ← seuil actuel' : '';
    lines.push(`  ≥ ${r.threshold.toFixed(1)}×   : ${r.hits}/${r.total} (${r.ratePct.toFixed(0)} %)${marker}`);
  }
  lines.push('');
  const conf = confluences(measures, opts.currentMomentum, opts.currentVolume);
  lines.push(`Confluences aux seuils actuels (${opts.currentMomentum} % et ${opts.currentVolume}×) : ${conf.length}`);
  for (const c of conf.slice(0, 15)) {
    lines.push(
      `  ${c.date}  ${c.code.padEnd(6)} ${c.momentumPct >= 0 ? '+' : ''}${c.momentumPct.toFixed(2)} %  vol ×${(c.volumeRatio as number).toFixed(1)}`,
    );
  }
  return lines.join('\n');
}
