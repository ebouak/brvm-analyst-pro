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
}

export function applyFilters(
  actions: ActionRow[],
  filters: ScreenerPreset['filters']
): ActionRow[] {
  return actions.filter((a) => {
    // RSI filters
    if (filters.rsiMin != null && a.rsi != null && a.rsi < filters.rsiMin) return false;
    if (filters.rsiMax != null && a.rsi != null && a.rsi > filters.rsiMax) return false;

    // Volume filter
    if (filters.volumeGtAvg && (!a.volume || a.volume === 0)) return false;

    // Score filter
    if (filters.scoreMin != null && a.score_signal != null && a.score_signal < filters.scoreMin)
      return false;

    // Sector filter
    if (filters.secteur && a.secteur !== filters.secteur) return false;

    // Dividend filter
    if (
      filters.dividendMin != null &&
      a.rendement_dividende != null &&
      a.rendement_dividende < filters.dividendMin
    )
      return false;

    return true;
  });
}
