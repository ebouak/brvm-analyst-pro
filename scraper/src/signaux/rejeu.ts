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

/** Sous-scores d'une séance, tels que computeScore les renvoie. */
export interface Composantes {
  variation: number;
  volume: number;
  macd: number;
  /** RSI déjà multiplié par le poids de régime. */
  rsi: number;
  tendance: number;
}

/**
 * Trois façons de composer le score, pour les comparer au banc :
 *  - actuel : la formule en production (hors pénalité de liquidité, qui ne fait
 *    qu'atténuer et ne change pas l'ordre des titres à liquidité égale) ;
 *  - retrait : RSI et tendance seuls ;
 *  - inversion : variation, volume et MACD comptés en sens contraire.
 */
export function variantesScore(c: Composantes): { actuel: number; retrait: number; inversion: number } {
  const momentum = P.W_VARIATION * c.variation + P.W_VOLUME * c.volume + P.W_MACD * c.macd;
  const contrarien = P.W_RSI * c.rsi + c.tendance;
  return { actuel: momentum + contrarien, retrait: contrarien, inversion: -momentum + contrarien };
}

/**
 * Écart haut − bas : chaque jour retenu, rendement relatif moyen des 20 % de titres
 * les mieux notés moins celui des 20 % les moins bien notés. Un jour sur `pas`
 * seulement, pour que les fenêtres de rendement ne se chevauchent pas.
 * Renvoie la moyenne, l'écart-type de la moyenne et le nombre de jours.
 */
export function ecartHautBas(
  obs: { date: string; score: number; rel: number }[],
  pas: number,
  part = 0.2,
): { moyenne: number; erreur: number; jours: number } | null {
  const parJour = new Map<string, { score: number; rel: number }[]>();
  for (const o of obs) (parJour.get(o.date) ?? parJour.set(o.date, []).get(o.date)!).push(o);
  const dates = [...parJour.keys()].sort();
  const ecarts: number[] = [];
  for (let i = 0; i < dates.length; i += pas) {
    const jour = parJour.get(dates[i]!)!.slice().sort((a, b) => a.score - b.score);
    const k = Math.floor(jour.length * part);
    if (k < 3) continue;
    const moy = (xs: { rel: number }[]) => xs.reduce((s, x) => s + x.rel, 0) / xs.length;
    ecarts.push(moy(jour.slice(-k)) - moy(jour.slice(0, k)));
  }
  if (ecarts.length < 5) return null;
  const m = ecarts.reduce((a, b) => a + b, 0) / ecarts.length;
  const sd = Math.sqrt(ecarts.reduce((s, x) => s + (x - m) ** 2, 0) / (ecarts.length - 1));
  return { moyenne: m, erreur: sd / Math.sqrt(ecarts.length), jours: ecarts.length };
}
