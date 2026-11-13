/**
 * Vues du screener (tableau, cartes, carte de chaleur) — logique PURE, testée.
 * La couleur d'une tuile encode la POSITION d'une mesure, jamais un verdict :
 * un RSI bas n'est pas « vert = à acheter ».
 */
import type { ActionRow } from './filters';

export type Vue = 'tableau' | 'cartes' | 'chaleur';
export type MesureChaleur = 'variation' | 'rsi' | 'rendement';

export const LIBELLE_MESURE: Record<MesureChaleur, string> = {
  variation: 'Variation du jour',
  rsi: 'RSI 14',
  rendement: 'Rendement du dividende',
};

export function valeurMesure(a: ActionRow, m: MesureChaleur): number | null {
  if (m === 'variation') return a.variation_pct;
  if (m === 'rsi') return a.rsi;
  return a.rendement_dividende;
}

/**
 * Niveau de −3 à +3 (0 = neutre), null si la donnée manque.
 * Variation : ±0,5 / ±2 / ±5 %. RSI : centré sur 50, paliers 40-60 / 30-70 /
 * au-delà. Rendement : 0 à +3 (pas de « négatif ») à 3 / 5 / 7 %.
 */
export function niveau(m: MesureChaleur, v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const palier = (x: number, bornes: [number, number, number]) => {
    const a = Math.abs(x);
    const n = a >= bornes[2] ? 3 : a >= bornes[1] ? 2 : a >= bornes[0] ? 1 : 0;
    return Math.sign(x) * n;
  };
  if (m === 'variation') return palier(v, [0.5, 2, 5]);
  if (m === 'rsi') return palier(v - 50, [10, 20, 30]);
  return v >= 7 ? 3 : v >= 5 ? 2 : v >= 3 ? 1 : 0;
}

export interface GroupeSecteur { secteur: string; actions: ActionRow[] }

/** Regroupe par secteur (« Non classé » en dernier), secteurs et valeurs triés. */
export function grouperParSecteur(actions: ActionRow[]): GroupeSecteur[] {
  const g = new Map<string, ActionRow[]>();
  for (const a of actions) {
    const s = a.secteur ?? 'Non classé';
    g.set(s, [...(g.get(s) ?? []), a]);
  }
  return [...g.entries()]
    .map(([secteur, liste]) => ({ secteur, actions: liste.sort((x, y) => x.code.localeCompare(y.code)) }))
    .sort((x, y) => (x.secteur === 'Non classé' ? 1 : y.secteur === 'Non classé' ? -1 : x.secteur.localeCompare(y.secteur, 'fr')));
}
