/**
 * Rejeu du scoring sur l'historique — fonctions PURES et testées (tests/rejeu.test.ts).
 *
 * Pourquoi : le banc (evaluation.ts) juge les scores ENREGISTRÉS. Pour comparer
 * deux formules (avant / après la correction du 2026-11-13), il faut recalculer
 * les deux sur les mêmes séances. Ce module reconstitue les entrées de
 * `computeScore` séance par séance, et recompose l'ANCIEN total à partir du
 * résultat du nouveau calcul, sans garder l'ancien code en production.
 */
import { clamp } from '../scoring/indicators.js';
import { SCORING_PARAMS as P, type ScoreInput, type ScoreResult } from '../scoring/score.js';

export interface LigneSeance {
  code: string;
  date: string; // AAAA-MM-JJ
  cours: number;
  variation_pct: number | null;
  volume: number | null;
}

/**
 * Score selon la formule d'AVANT le 2026-11-13 :
 *  - volume : |tanh(log(ratio))| × sens du jour (un volume faible confirmait) ;
 *  - liquidité : pénalité SOUSTRAITE du total.
 * Les autres composantes sont inchangées et relues dans le résultat.
 */
export function ancienScore(r: ScoreResult): number {
  const dir = Math.sign(r.inputs.variation_pct ?? 0);
  const ratio = r.inputs.volume_ratio;
  const ancienVolume = ratio == null || dir === 0 ? 0 : clamp(Math.abs(clamp(Math.tanh(Math.log(ratio + 1e-9)), -1, 1)) * dir, -1, 1);
  const total =
    P.W_VARIATION * (r.score_variation ?? 0) +
    P.W_VOLUME * ancienVolume +
    P.W_MACD * (r.score_macd ?? 0) +
    P.W_RSI * (r.score_rsi ?? 0) * r.inputs.rsi_regime_weight +
    r.bonus_tendance -
    r.penalite_liquidite;
  return clamp(total, -1, 1);
}

/** Volume moyen sur les 30 jours CALENDAIRES qui finissent à `date` (comme mv_volume_avg_30d). */
export function volumeMoyen30j(historique: LigneSeance[], i: number): number | null {
  const fin = Date.parse(`${historique[i]!.date}T00:00:00Z`);
  const debut = fin - 30 * 86_400_000;
  const vols: number[] = [];
  for (let j = i; j >= 0; j--) {
    const t = Date.parse(`${historique[j]!.date}T00:00:00Z`);
    if (t < debut) break;
    const v = historique[j]!.volume;
    if (v != null) vols.push(v);
  }
  return vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
}

/** Entrées de `computeScore` pour la séance `i` d'un titre (historique trié par date croissante). */
export function entreeSeance(historique: LigneSeance[], i: number, liquidite: number | null): ScoreInput {
  const s = historique[i]!;
  return {
    code: s.code,
    closes: historique.slice(0, i + 1).map((h) => h.cours),
    variation_pct: s.variation_pct,
    volume: s.volume,
    avg_volume_30d: volumeMoyen30j(historique, i),
    liquidity_score: liquidite,
  };
}

/** Corrélation de rang de Spearman (rangs moyens en cas d'égalité). null sous 3 points. */
export function spearman(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const rangs = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(v.length);
    for (let k = 0; k < idx.length; ) {
      let m = k;
      while (m + 1 < idx.length && idx[m + 1]![0] === idx[k]![0]) m++;
      const moyen = (k + m) / 2 + 1;
      for (let q = k; q <= m; q++) r[idx[q]![1]] = moyen;
      k = m + 1;
    }
    return r;
  };
  const rx = rangs(xs.slice(0, n));
  const ry = rangs(ys.slice(0, n));
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}
