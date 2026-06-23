/** Constructeur de rapport : helpers purs (parsing des blocs + synthèses légères). */

export type BlockKey = 'marche' | 'action' | 'secteur' | 'portefeuille';
export const ALL_BLOCKS: BlockKey[] = ['marche', 'action', 'secteur', 'portefeuille'];
export const BLOCK_LABEL: Record<BlockKey, string> = {
  marche: 'Synthèse marché du jour',
  action: 'Une action',
  secteur: 'Un secteur',
  portefeuille: 'Mon portefeuille',
};

/** Parse la query `blocs=marche,action` → liste ordonnée et dédupliquée de blocs valides. */
export function parseBlocks(raw: string | undefined | null): BlockKey[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: BlockKey[] = [];
  for (const part of raw.split(',').map((s) => s.trim())) {
    if ((ALL_BLOCKS as string[]).includes(part) && !seen.has(part)) {
      seen.add(part);
      out.push(part as BlockKey);
    }
  }
  return out;
}

export interface MarketRow { code: string; variation_pct: number | null }
export interface MarketSummary {
  hausses: number; baisses: number; inchanges: number; total: number;
  breadthPct: number | null;
  topHausse: { code: string; pct: number } | null;
  topBaisse: { code: string; pct: number } | null;
}

/** Agrège une séance (variations %) en breadth + meilleur/pire titre. Fonction pure. */
export function summarizeMarket(rows: MarketRow[]): MarketSummary {
  let hausses = 0, baisses = 0, inchanges = 0;
  let topHausse: MarketSummary['topHausse'] = null;
  let topBaisse: MarketSummary['topBaisse'] = null;
  for (const r of rows) {
    const v = r.variation_pct;
    if (v == null) continue;
    if (v > 0) hausses++; else if (v < 0) baisses++; else inchanges++;
    if (!topHausse || v > topHausse.pct) topHausse = { code: r.code, pct: v };
    if (!topBaisse || v < topBaisse.pct) topBaisse = { code: r.code, pct: v };
  }
  const total = hausses + baisses + inchanges;
  return {
    hausses, baisses, inchanges, total,
    breadthPct: total > 0 ? Math.round((hausses / total) * 100) : null,
    topHausse, topBaisse,
  };
}
