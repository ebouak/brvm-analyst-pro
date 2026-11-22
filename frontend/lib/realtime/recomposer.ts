/**
 * Logique PURE pour les pages de l'application qui affichent des cours en
 * direct (hors landing).
 *
 * `useRealtimeActions` remplace une ligne par celle que renvoie la base. Or les
 * pages de l'application enrichissent leurs lignes côté serveur (désignation,
 * secteur, pays, quantités d'une position…) : remplacer sans recomposer les
 * effacerait au premier cours reçu. On repart donc toujours de la ligne de
 * départ et on n'y écrase QUE les colonnes de marché reçues.
 *
 * Un code absent de la base de départ est ignoré : une ligne sans désignation
 * ni secteur casserait l'affichage, et une valeur nouvellement cotée attend le
 * prochain rendu serveur (voir l'admission de BBGC, CLAUDE.md 2026-09-24).
 */
import type { RealtimeActionRow } from './mergeActions';

/** Colonnes de marché qu'un événement Realtime peut mettre à jour. */
export const COLONNES_DIRECT = [
  'cours_jour',
  'variation_pct',
  'volume',
  'valeur_echangee',
  'nb_transactions',
] as const;

export function recomposer<T extends RealtimeActionRow>(
  base: readonly T[],
  recus: readonly RealtimeActionRow[],
): T[] {
  const parCode = new Map(recus.map((r) => [r.code, r]));
  return base.map((ligne) => {
    const recu = parCode.get(ligne.code);
    if (!recu) return ligne;
    let suite: T | null = null;
    for (const col of COLONNES_DIRECT) {
      if (!(col in recu)) continue;
      const v = recu[col];
      // Une colonne reçue à null n'efface pas une valeur connue : un trou de
      // collecte n'est pas un cours.
      if (v == null) continue;
      if (v !== ligne[col]) {
        suite ??= { ...ligne };
        (suite as RealtimeActionRow)[col] = v;
      }
    }
    return suite ?? ligne;
  });
}

/** Heure d'une mise à jour, au format affiché « HH:MM » (heure d'Abidjan = UTC). */
export function heureMaj(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
