/** En-tête « Séance du jour » (lot 5). PUR : comptes dérivés des variations lues en base. */

export interface Souffle { hausses: number; baisses: number; stables: number; total: number }

/** Une variation absente est ignorée du total (jamais comptée comme stable). */
export function souffleMarche(variations: (number | null | undefined)[]): Souffle {
  let hausses = 0, baisses = 0, stables = 0;
  for (const v of variations) {
    if (v == null || !Number.isFinite(v)) continue;
    if (v > 0) hausses++;
    else if (v < 0) baisses++;
    else stables++;
  }
  return { hausses, baisses, stables, total: hausses + baisses + stables };
}
