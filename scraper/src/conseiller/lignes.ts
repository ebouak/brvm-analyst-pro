import type { LiquidityClass } from '../liquidity/compute.js';
import { FAMILLES_FACTEURS, type FamilleFacteur } from './types.js';
import type { ScoresFamilles } from './facteurs.js';

/** Version du calcul écrit en base. À changer si une règle de facteurs change. */
export const MOTEUR_VERSION = 'facteurs-v2-2026-11-09';

export type Tier = 'haut' | 'milieu' | 'bas';
type ParFamille<T> = Record<FamilleFacteur, T>;

export interface LigneFacteurs {
  date_marche: string;
  code: string;
  scores: ParFamille<number | null>;
  tiers: ParFamille<Tier | null>;
  effectifs: ParFamille<number>;
  classe_liquidite: LiquidityClass | null;
  moteur_version: string;
}

/** Rang [−1, +1] → tiers. Les bornes ±1/3 suivent la règle du banc. */
export function tierDe(v: number | null): Tier | null {
  if (v == null) return null;
  if (v >= 1 / 3) return 'haut';
  if (v <= -1 / 3) return 'bas';
  return 'milieu';
}

/** Une ligne par valeur. `effectifs` = nombre de valeurs classées par famille ce jour-là. */
export function lignesFacteurs(date: string, scores: Map<string, ScoresFamilles>, classes: Map<string, LiquidityClass | null>): LigneFacteurs[] {
  const effectifs = Object.fromEntries(
    FAMILLES_FACTEURS.map((f) => [f, [...scores.values()].filter((s) => s[f] != null).length]),
  ) as ParFamille<number>;
  return [...scores]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([code, s]) => ({
      date_marche: date,
      code,
      scores: { ...s },
      tiers: Object.fromEntries(FAMILLES_FACTEURS.map((f) => [f, tierDe(s[f])])) as ParFamille<Tier | null>,
      effectifs,
      classe_liquidite: classes.get(code) ?? null,
      moteur_version: MOTEUR_VERSION,
    }));
}

export const MARGE_LIGNES = 2;
export const PART_NULLE_MAX = 0.3;

/** Contrôle d'un lot relu en base. Renvoie la liste des anomalies ; vide = conforme. */
export function verifierEcriture(lignes: LigneFacteurs[], derniereSeance: string, nbCotees: number): string[] {
  const erreurs: string[] = [];
  if (lignes.some((l) => l.date_marche !== derniereSeance)) erreurs.push(`séance écrite différente de la dernière séance (${derniereSeance})`);
  if (lignes.length < nbCotees - MARGE_LIGNES) erreurs.push(`${lignes.length} lignes pour ${nbCotees} valeurs cotées`);
  const nulles = lignes.filter((l) => FAMILLES_FACTEURS.every((f) => l.scores[f] == null)).length;
  if (lignes.length > 0 && nulles / lignes.length > PART_NULLE_MAX) erreurs.push(`${nulles} lignes entièrement nulles sur ${lignes.length}`);
  return erreurs;
}
