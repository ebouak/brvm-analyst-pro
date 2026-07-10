// Fonctions pures pour le module Rapports interactifs.
// Sans I/O, sans dépendances — testables en vitest.

/** Variation en % entre deux cours. */
export function computeVariation(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

/**
 * Top N titres par variation (hausses ou baisses).
 * Les lignes avec variation_pct null sont exclues.
 */
export function topMovers<T extends { variation_pct: number | null }>(
  rows: T[],
  n: number,
  dir: 'up' | 'down',
): T[] {
  return [...rows]
    .filter((r) => r.variation_pct != null)
    .sort((a, b) =>
      dir === 'up'
        ? (b.variation_pct ?? 0) - (a.variation_pct ?? 0)
        : (a.variation_pct ?? 0) - (b.variation_pct ?? 0),
    )
    .slice(0, n);
}

/**
 * Rendement d'une série de clôtures sur toute la période : du premier cours
 * non-nul à la dernière clôture. Renvoie null si l'un des deux manque (0 = jour
 * sans cotation traité comme absent, cohérent avec le tableau de stats).
 * Source unique de vérité partagée par le résumé exécutif et les stats par titre.
 */
export function periodReturn(closes: number[]): number | null {
  const first = closes.find((c) => c > 0) ?? null;
  const last = closes.length > 0 ? (closes[closes.length - 1] ?? null) : null;
  if (!first || !last) return null;
  return ((last - first) / first) * 100;
}

/**
 * Normalise une série de cours en base 100.
 * Le premier cours non-null devient 100. Les null restent null.
 */
export function normalizeBase100(closes: (number | null)[]): (number | null)[] {
  const base = closes.find((v) => v != null && v > 0) ?? null;
  if (base === null) return closes.map(() => null);
  return closes.map((v) => (v == null ? null : (v / base) * 100));
}

/**
 * Filtre des événements par plage de dates (bornes incluses).
 * T doit exposer `event_date` au format ISO YYYY-MM-DD.
 */
export function filterEventsByPeriod<T extends { event_date: string }>(
  events: T[],
  from: string,
  to: string,
): T[] {
  return events.filter((e) => e.event_date >= from && e.event_date <= to);
}

/**
 * Volatilité sur les 20 derniers rendements journaliers (écart-type population).
 * Renvoie null si moins de 2 clôtures.
 */
export function volatility20d(closes: number[]): number | null {
  const window = closes.slice(-21); // 21 cours → 20 rendements
  if (window.length < 2) return null;
  const rets: number[] = [];
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1]!;
    const cur = window[i]!;
    if (prev > 0) rets.push((cur - prev) / prev);
  }
  if (rets.length === 0) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance);
}
