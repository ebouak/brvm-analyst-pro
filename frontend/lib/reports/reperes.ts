export interface Evenement { date: string; type: 'resultats' | 'dividende'; libelle: string }
export interface Repere extends Evenement { x: string }

/**
 * Repères datés sur la courbe de cours. La courbe est échantillonnée : chaque
 * événement est calé sur la première date tracée qui le suit (le cours réagit
 * après l'événement). Hors de la période tracée, il est écarté, pas déplacé.
 */
export function reperesSurCourbe(datesCourbe: string[], evenements: Evenement[]): Repere[] {
  if (datesCourbe.length === 0) return [];
  const dates = [...datesCourbe].sort();
  const debut = dates[0]!, fin = dates[dates.length - 1]!;
  return evenements
    .filter((e) => /^\d{4}-\d{2}-\d{2}/.test(e.date))
    .map((e) => ({ ...e, date: e.date.slice(0, 10) }))
    .filter((e) => e.date >= debut && e.date <= fin)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ ...e, x: dates.find((d) => d >= e.date)! }));
}

export interface Echelle { min: number; max: number; pas: number; ticks: number[] }

/**
 * Échelle à graduations régulières (pas = 1, 2, 2,5 ou 5 × 10^k) qui encadre [min, max].
 * Elle contient zéro par défaut (barres) ; une courbe de cours passe `inclureZero = false`
 * et obtient des graduations rondes (1 000, 2 000…) au lieu de 640,4 / 1 640,4.
 */
export function echelleReguliere(minDonnees: number, maxDonnees: number, cibleGraduations = 5, inclureZero = true): Echelle {
  const lo = inclureZero ? Math.min(minDonnees, 0) : minDonnees;
  const hi = inclureZero ? Math.max(maxDonnees, 0) : maxDonnees;
  const etendue = hi - lo;
  if (!(etendue > 0)) return { min: 0, max: 1, pas: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const brut = etendue / cibleGraduations;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut)!;
  const min = Math.floor(lo / pas + 1e-9) * pas;
  const max = Math.ceil(hi / pas - 1e-9) * pas;
  const ticks: number[] = [];
  for (let t = min; t <= max + pas / 1000; t += pas) ticks.push(Math.round(t / pas) * pas);
  return { min, max, pas, ticks };
}

export interface RepereEtiquete extends Repere { etiquette: boolean }

/**
 * Sur une longue période, les repères se touchent et leurs lettres se chevauchent.
 * On garde tous les repères (trait discret) mais on n'écrit la lettre que si le repère
 * est éloigné d'au moins `ecartMin` (fraction de la période) du dernier repère étiqueté.
 */
export function etiquettesEspacees(reperes: Repere[], datesCourbe: string[], ecartMin = 0.05): RepereEtiquete[] {
  const dates = [...datesCourbe].sort();
  const n = Math.max(dates.length - 1, 1);
  let dernier = -Infinity;
  return reperes.map((r) => {
    const pos = Math.max(dates.indexOf(r.x), 0) / n;
    const etiquette = pos - dernier >= ecartMin;
    if (etiquette) dernier = pos;
    return { ...r, etiquette };
  });
}
