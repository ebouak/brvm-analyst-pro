/**
 * Logique PURE de fusion des cours reçus en temps réel (Supabase Realtime).
 * Aucune I/O : reçoit un événement déjà parsé + l'état courant, renvoie le
 * nouvel état et la direction du changement (pour piloter le flash vert/rouge).
 * Testable en isolation ; le hook useRealtimeActions gère l'abonnement.
 */

/** Sous-ensemble des colonnes de brvm_actions_daily nécessaire au live. */
export interface RealtimeActionRow {
  code: string;
  cours_jour: number | null;
  variation_pct: number | null;
  volume?: number | null;
}

export type FlashDirection = 'up' | 'down' | 'none';

export interface MergeResult<T extends RealtimeActionRow> {
  rows: T[];
  /** Direction du changement pour la ligne concernée (flash). */
  direction: FlashDirection;
  /** Vrai si la donnée a réellement changé (évite un flash inutile). */
  changed: boolean;
}

/** Direction du flash en comparant l'ancien et le nouveau cours. */
export function flashDirection(prev: number | null | undefined, next: number | null | undefined): FlashDirection {
  if (prev == null || next == null || prev === next) return 'none';
  return next > prev ? 'up' : 'down';
}

/**
 * Applique un changement Realtime à l'état courant : remplace la ligne de même
 * `code` (ou l'ajoute si absente) et calcule la direction du flash. N'altère
 * jamais le tableau d'entrée (renvoie une nouvelle référence).
 */
export function mergeActionRow<T extends RealtimeActionRow>(rows: T[], change: T): MergeResult<T> {
  const idx = rows.findIndex((r) => r.code === change.code);

  if (idx === -1) {
    return { rows: [...rows, change], direction: 'none', changed: true };
  }

  const prev = rows[idx]!;
  const direction = flashDirection(prev.cours_jour, change.cours_jour);
  const changed =
    prev.cours_jour !== change.cours_jour || prev.variation_pct !== change.variation_pct;

  if (!changed) {
    return { rows, direction: 'none', changed: false };
  }

  const next = [...rows];
  next[idx] = change;
  return { rows: next, direction, changed: true };
}
