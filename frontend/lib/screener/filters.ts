import type { ScreenerPreset } from './presets.js';

export interface ActionRow {
  code: string;
  cours_jour: number | null;
  variation_pct: number | null;
  rsi: number | null;
  volume: number | null;
  score_signal: number | null;
  secteur: string | null;
  rendement_dividende: number | null;
  /** Score de liquidité 0-100 (lib/liquidity, ~30 séances) — null si inconnu. */
  liquidite_score?: number | null;
  /** Classe A/B/C/D dérivée du score. */
  liquidite_classe?: string | null;
  /** Volume de la séance ÷ volume moyen des 20 séances précédentes — null si inconnu. */
  volume_ratio?: number | null;
}

/**
 * Une valeur dont la donnée filtrée est INCONNUE ne passe plus le filtre
 * (audit 2026-11-13) : avant, un RSI absent satisfaisait « RSI < 30 », et le
 * préréglage « Survendu » renvoyait les 48 valeurs. Les valeurs écartées ainsi
 * sont comptées par `exclusFauteDeDonnee` et annoncées à l'écran : jamais
 * d'exclusion silencieuse.
 */
function manqueDonnee(a: ActionRow, filters: ScreenerPreset['filters']): boolean {
  if ((filters.rsiMin != null || filters.rsiMax != null) && a.rsi == null) return true;
  if (filters.scoreMin != null && a.score_signal == null) return true;
  if (filters.dividendMin != null && a.rendement_dividende == null) return true;
  if (filters.secteur && a.secteur == null) return true;
  if (filters.volumeGtAvg && a.volume_ratio == null) return true;
  return false;
}

export function exclusFauteDeDonnee(actions: ActionRow[], filters: ScreenerPreset['filters']): number {
  return actions.filter((a) => manqueDonnee(a, filters)).length;
}

export function applyFilters(
  actions: ActionRow[],
  filters: ScreenerPreset['filters']
): ActionRow[] {
  return actions.filter((a) => {
    if (manqueDonnee(a, filters)) return false;

    if (filters.rsiMin != null && a.rsi != null && a.rsi < filters.rsiMin) return false;
    if (filters.rsiMax != null && a.rsi != null && a.rsi > filters.rsiMax) return false;

    // « Fort volume » : au-dessus de la moyenne 20 séances, et non plus « volume > 0 ».
    if (filters.volumeGtAvg && a.volume_ratio != null && a.volume_ratio <= 1) return false;

    if (filters.scoreMin != null && a.score_signal != null && a.score_signal < filters.scoreMin)
      return false;

    if (filters.secteur && a.secteur !== filters.secteur) return false;

    if (
      filters.dividendMin != null &&
      a.rendement_dividende != null &&
      a.rendement_dividende < filters.dividendMin
    )
      return false;

    return true;
  });
}
