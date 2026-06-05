/**
 * Fonctions utiles d'analyse de portefeuille (pures, testables).
 *
 * Outils que tout analyste/trader veut : exposition sectorielle, concentration
 * (HHI), meilleure/pire ligne, P&L agrégé, allocation cash vs actions.
 * Indépendantes de l'UI — réutilisables côté serveur comme client.
 */

export interface PositionLike {
  code: string;
  secteur?: string | null;
  quantite: number;
  prix_entree: number;        // PRU
  last?: number | null;       // dernier cours marché
  is_liquidites?: boolean;
}

export interface ComputedPosition extends PositionLike {
  cost: number;               // PRU × quantité
  value: number | null;       // cours × quantité (ou montant pour liquidités)
  pnl: number | null;         // value − cost
  pnlPct: number | null;      // pnl / cost
  ponderation: number;        // value / total
}

/** Valorise une liste de positions au cours du marché et calcule les pondérations. */
export function computePositions(positions: PositionLike[]): {
  rows: ComputedPosition[];
  totalCost: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number | null;
} {
  let totalCost = 0;
  let totalValue = 0;

  const partial = positions.map((p) => {
    const isLiq = p.is_liquidites || p.code === 'LIQUIDITES';
    const cost = isLiq ? p.prix_entree : p.quantite * p.prix_entree;
    const value = isLiq ? p.prix_entree : (p.last != null ? p.quantite * p.last : null);
    const pnl = isLiq ? 0 : (value != null ? value - cost : null);
    const pnlPct = cost > 0 && pnl != null ? pnl / cost : null;
    totalCost += cost;
    if (value != null) totalValue += value;
    return { ...p, cost, value, pnl, pnlPct };
  });

  const rows: ComputedPosition[] = partial.map((p) => ({
    ...p,
    ponderation: totalValue > 0 && p.value != null ? p.value / totalValue : 0,
  }));

  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : null;
  return { rows, totalCost, totalValue, totalPnl, totalPnlPct };
}

/** Agrège la valorisation par secteur, triée par poids décroissant. */
export function sectorBreakdown(rows: ComputedPosition[]): Array<{ secteur: string; valeur: number; pct: number }> {
  const total = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r.value == null) continue;
    const s = r.is_liquidites || r.code === 'LIQUIDITES' ? 'Liquidités' : (r.secteur ?? 'Autres');
    map[s] = (map[s] ?? 0) + r.value;
  }
  return Object.entries(map)
    .map(([secteur, valeur]) => ({ secteur, valeur, pct: total > 0 ? (valeur / total) * 100 : 0 }))
    .sort((a, b) => b.valeur - a.valeur);
}

/**
 * Indice de concentration Herfindahl-Hirschman (HHI), sur les positions hors
 * liquidités. 0 = parfaitement diversifié, 1 = 100 % sur une seule ligne.
 * Repère : >0,25 = portefeuille concentré (risque idiosyncratique élevé).
 */
export function concentrationHHI(rows: ComputedPosition[]): number {
  const equities = rows.filter((r) => !(r.is_liquidites || r.code === 'LIQUIDITES'));
  const total = equities.reduce((s, r) => s + (r.value ?? 0), 0);
  if (total <= 0) return 0;
  return equities.reduce((s, r) => {
    const w = (r.value ?? 0) / total;
    return s + w * w;
  }, 0);
}

/** Part des liquidités dans le portefeuille total (0 à 1). */
export function cashRatio(rows: ComputedPosition[]): number {
  const total = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  if (total <= 0) return 0;
  const cash = rows
    .filter((r) => r.is_liquidites || r.code === 'LIQUIDITES')
    .reduce((s, r) => s + (r.value ?? 0), 0);
  return cash / total;
}

/** Meilleure et pire ligne en P&L % (hors liquidités). */
export function bestWorst(rows: ComputedPosition[]): {
  best: ComputedPosition | null;
  worst: ComputedPosition | null;
} {
  const withPnl = rows.filter(
    (r) => !(r.is_liquidites || r.code === 'LIQUIDITES') && r.pnlPct != null
  );
  if (withPnl.length === 0) return { best: null, worst: null };
  const sorted = [...withPnl].sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
  return { best: sorted[0]!, worst: sorted[sorted.length - 1]! };
}

/** Nombre de lignes hors liquidités. */
export function nbHoldings(rows: ComputedPosition[]): number {
  return rows.filter((r) => !(r.is_liquidites || r.code === 'LIQUIDITES')).length;
}
