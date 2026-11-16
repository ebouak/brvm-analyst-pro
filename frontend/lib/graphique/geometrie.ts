// Graphique avancé : outils de dessin (calculs purs).
//
// Un dessin est ancré en (date, prix) — jamais en pixels — pour survivre au
// zoom, au défilement, au changement d'intervalle et à l'échelle logarithmique.
// La conversion date ↔ position « logique » (rang de barre, fractionnaire) se
// fait ici ; la conversion en pixels reste à la bibliothèque de graphique.

import type { Barre, Intervalle, Seance } from './donnees';

export const NIVEAUX_FIBONACCI = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

export interface Ancre {
  t: string; // AAAA-MM-JJ
  p: number; // prix (FCFA)
}

/** Ajoute `n` pas d'intervalle à une date (jours ouvrés pour « jour »). */
export function avancerDate(date: string, n: number, intervalle: Intervalle): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (intervalle === 'semaine') {
    d.setUTCDate(d.getUTCDate() + 7 * n);
  } else if (intervalle === 'mois') {
    const jour = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(jour, dernier));
  } else {
    let reste = n;
    while (reste > 0) {
      d.setUTCDate(d.getUTCDate() + 1);
      const j = d.getUTCDay();
      if (j !== 0 && j !== 6) reste -= 1;
    }
  }
  return d.toISOString().slice(0, 10);
}

/** Nombre de pas d'intervalle entre deux dates (a ≤ b). */
export function pasEntre(a: string, b: string, intervalle: Intervalle): number {
  if (b <= a) return 0;
  let n = 0;
  let d = a;
  // Les dessins débordent de quelques dizaines de pas au plus : la boucle reste courte.
  while (d < b && n < 5000) {
    d = avancerDate(d, 1, intervalle);
    n += 1;
  }
  return n;
}

/** Dernier rang dont la date est ≤ t (recherche dichotomique), -1 si avant tout. */
function rangAuPlus(barres: readonly Pick<Barre, 'date'>[], t: string): number {
  let lo = 0;
  let hi = barres.length - 1;
  let r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (barres[m]!.date <= t) {
      r = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
}

/**
 * Date → position logique. Une date entre deux barres tombe sur la barre qui
 * la contient (dernière barre de date ≤ t ; en semaine/mois, la barre porte la
 * date de sa dernière séance, donc on prend la première barre de date ≥ t).
 * Au-delà de la dernière barre, on extrapole d'un pas par intervalle.
 */
export function dateVersLogique(barres: readonly Pick<Barre, 'date'>[], t: string, intervalle: Intervalle): number | null {
  const n = barres.length;
  if (n === 0) return null;
  const derniere = barres[n - 1]!.date;
  if (t > derniere) return n - 1 + pasEntre(derniere, t, intervalle);
  if (intervalle === 'jour') {
    const r = rangAuPlus(barres, t);
    return r < 0 ? 0 : r;
  }
  const r = rangAuPlus(barres, t);
  if (r >= 0 && barres[r]!.date === t) return r;
  return Math.min(n - 1, r + 1);
}

/** Position logique → date (arrondie au rang le plus proche ; extrapolée à droite). */
export function logiqueVersDate(barres: readonly Pick<Barre, 'date'>[], logique: number, intervalle: Intervalle): string | null {
  const n = barres.length;
  if (n === 0 || !Number.isFinite(logique)) return null;
  const r = Math.round(logique);
  if (r <= 0) return barres[0]!.date;
  if (r <= n - 1) return barres[r]!.date;
  return avancerDate(barres[n - 1]!.date, r - (n - 1), intervalle);
}

export interface NiveauFibonacci {
  ratio: number;
  libelle: string; // « 38,2 % »
  prix: number;
}

/**
 * Retracement de Fibonacci tracé de `a` (premier clic) vers `b` (second clic) :
 * 0 % sur `b`, 100 % sur `a`. Tracé d'un creux vers un sommet, les niveaux
 * mesurent donc le repli depuis le sommet.
 */
export function niveauxFibonacci(a: Ancre, b: Ancre): NiveauFibonacci[] {
  return NIVEAUX_FIBONACCI.map((ratio) => ({
    ratio,
    libelle: `${(ratio * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`,
    prix: b.p + (a.p - b.p) * ratio,
  }));
}

export interface Mesure {
  ecart: number; // FCFA, signé (b − a dans le temps)
  ecartPct: number | null;
  seances: number; // séances réellement cotées entre les deux dates
  debut: string;
  fin: string;
}

/**
 * Mesure entre deux ancres, ordonnées dans le temps. Le nombre de séances est
 * compté sur les séances COTÉES en base (pas sur le calendrier) : une
 * semaine sans cotation ne compte pas.
 */
export function mesurer(a: Ancre, b: Ancre, seances: readonly Pick<Seance, 'date'>[]): Mesure {
  const [x, y] = a.t <= b.t ? [a, b] : [b, a];
  const n = seances.filter((s) => s.date > x.t && s.date <= y.t).length;
  return {
    ecart: y.p - x.p,
    ecartPct: x.p > 0 ? ((y.p - x.p) / x.p) * 100 : null,
    seances: n,
    debut: x.t,
    fin: y.t,
  };
}
