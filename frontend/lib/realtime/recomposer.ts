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

/**
 * « En direct » n'est vrai que si l'on montre la séance du JOUR : soit la page
 * a été rendue avec les cours du jour, soit un cours du jour est réellement
 * arrivé depuis. Avant le premier relevé (9 h 00 → ~9 h 15), un onglet ouvert
 * depuis la veille ou un jour férié en semaine ne prétendent rien.
 * (Revue Fable du 2026-11-22 : l'abonnement écoutait la séance précédente et
 * affichait « En direct » sans jamais rien recevoir.)
 */
export function estEnDirect(o: {
  enSeance: boolean;
  dateMarche: string | null;
  jour: string | null;
  majRecue: boolean;
}): boolean {
  if (!o.enSeance || o.dateMarche == null || o.jour == null) return false;
  return o.dateMarche === o.jour || o.majRecue;
}

/** Vrai si une colonne de marché a changé entre deux états affichés. */
export function valeursChangees(avant: readonly RealtimeActionRow[], apres: readonly RealtimeActionRow[]): boolean {
  if (avant.length !== apres.length) return true;
  return apres.some((r, i) => {
    const a = avant[i]!;
    return a.code !== r.code || a.cours_jour !== r.cours_jour || a.variation_pct !== r.variation_pct || (a.volume ?? null) !== (r.volume ?? null);
  });
}

/** Heure d'une mise à jour, au format affiché « HH:MM » (heure d'Abidjan = UTC). */
export function heureMaj(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
