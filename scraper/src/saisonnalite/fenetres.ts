/**
 * Fenêtres d'événement (saisonnalité v2, lot 3, F6) — PUR, testé.
 * Parcours de l'écart au marché, en rendement total, de `avant` séances avant
 * à `apres` séances après un événement ; délai de retour au cours d'avant
 * détachement. Plan : docs/superpowers/plans/2026-11-10-saisonnalite-v2-lot3.md.
 */
import type { Dividende, Serie } from '../conseiller/types.js';

/** Rendement total séance à séance (coupon réintégré le jour du détachement). Index 0 : null. */
export function rendementsQuotidiens(s: Serie, dividendes: Dividende[]): (number | null)[] {
  const coupon = new Map<string, number>();
  for (const d of dividendes) if (d.exDate && d.montant > 0) coupon.set(d.exDate, (coupon.get(d.exDate) ?? 0) + d.montant);
  return s.cours.map((c, i) => {
    if (i === 0) return null;
    const prec = s.cours[i - 1]!;
    return prec > 0 && c > 0 ? (c + (coupon.get(s.dates[i]!) ?? 0)) / prec - 1 : null;
  });
}

/** Rendement quotidien du marché : moyenne équipondérée, chaque valeur écrêtée à ±30 %. */
export function marcheQuotidien(series: { dates: string[]; r: (number | null)[] }[], ecretage = 0.3): Map<string, number> {
  const acc = new Map<string, { s: number; n: number }>();
  for (const { dates, r } of series) {
    r.forEach((x, i) => {
      if (x == null || !Number.isFinite(x)) return;
      const a = acc.get(dates[i]!) ?? { s: 0, n: 0 };
      a.s += Math.max(-ecretage, Math.min(ecretage, x));
      a.n++;
      acc.set(dates[i]!, a);
    });
  }
  return new Map([...acc].map(([d, a]) => [d, a.s / a.n]));
}

/**
 * Un parcours par événement : écart cumulé au marché, de la séance −`avant` à
 * +`apres` (rang 0 = première séance à la date de l'événement ou après), base
 * la clôture qui précède la fenêtre. Fenêtre écartée si incomplète, si un
 * rendement manque, ou si une rupture non expliquée la traverse.
 */
export function cheminsEvenements(e: {
  serie: Serie;
  r: (number | null)[];
  marche: Map<string, number>;
  dates: string[];
  ruptures: Set<string>;
  avant?: number;
  apres?: number;
}): number[][] {
  const avant = e.avant ?? 20;
  const apres = e.apres ?? 40;
  const s = e.serie;
  const out: number[][] = [];
  for (const date of e.dates) {
    const i = s.dates.findIndex((d) => d >= date);
    if (i < 0 || i - avant - 1 < 0 || i + apres >= s.dates.length) continue;
    const debut = s.dates[i - avant - 1]!;
    const fin = s.dates[i + apres]!;
    if ([...e.ruptures].some((r) => r > debut && r <= fin)) continue;
    let v = 1;
    let m = 1;
    const chemin: number[] = [];
    let complet = true;
    for (let k = -avant; k <= apres; k++) {
      const t = i + k;
      const rv = e.r[t];
      if (rv == null) { complet = false; break; }
      v *= 1 + rv;
      m *= 1 + (e.marche.get(s.dates[t]!) ?? 0);
      chemin.push(v / m - 1);
    }
    if (complet) out.push(chemin);
  }
  return out;
}

export interface PointFenetre { rang: number; moyenne: number; mediane: number; part_positifs: number; n: number }

/** Agrégat par rang des parcours (rang du premier point = −`avant`). */
export function agreger(chemins: number[][], avant = 20): PointFenetre[] {
  if (chemins.length === 0) return [];
  const long = chemins[0]!.length;
  const out: PointFenetre[] = [];
  for (let j = 0; j < long; j++) {
    const xs = chemins.map((c) => c[j]!).sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    out.push({
      rang: j - avant,
      moyenne: xs.reduce((a, b) => a + b, 0) / xs.length,
      mediane: xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2,
      part_positifs: xs.filter((x) => x > 0).length / xs.length,
      n: xs.length,
    });
  }
  return out;
}

/**
 * Après un détachement, le cours revient-il à la clôture de la veille ? Pour
 * chaque horizon (en séances) : détachements revenus / détachements observables
 * (revenus avant la fin des données, ou suivis jusqu'à l'horizon).
 */
export function retourCoupon(s: Serie, exDates: string[], horizons = [20, 60, 250]): { horizon: number; revenus: number; n: number }[] {
  const delais: (number | null)[] = [];
  const restants: number[] = [];
  for (const d of exDates) {
    const i = s.pos.get(d) ?? -1;
    if (i < 1) continue;
    const veille = s.cours[i - 1]!;
    let delai: number | null = null;
    for (let t = i; t < s.cours.length; t++) if (s.cours[t]! >= veille) { delai = t - i; break; }
    delais.push(delai);
    restants.push(s.cours.length - 1 - i);
  }
  return horizons.map((h) => {
    let revenus = 0;
    let n = 0;
    delais.forEach((dl, k) => {
      if (dl != null && dl <= h) { revenus++; n++; } else if (restants[k]! >= h) n++;
    });
    return { horizon: h, revenus, n };
  });
}
