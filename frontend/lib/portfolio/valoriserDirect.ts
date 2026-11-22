/**
 * Valorisation d'un portefeuille à partir des derniers cours connus.
 *
 * Fonction PURE, reprise À L'IDENTIQUE du calcul de `app/portefeuille/page.tsx`
 * (rendu serveur) : les cours en direct ne doivent jamais donner un autre
 * résultat que le serveur pour les mêmes cours. Toute correction de l'un se
 * reporte dans l'autre — le test `valoriserDirect.test.ts` fige les deux règles
 * qui comptent :
 *   - une ligne sans cours connu n'a ni valeur ni plus-value (elle n'entre pas
 *     dans la valeur des actions, mais son coût entre dans le coût total) ;
 *   - `totalPnlPct` est une FRACTION (0,05 = 5 %), `pnlPct` d'une ligne un
 *     POURCENTAGE (5 = 5 %), comme dans la page.
 */
export interface PositionValorisable {
  code: string;
  quantite: number;
  prix_entree: number;
}

export interface LigneValorisee {
  code: string;
  last: number | null;
  cost: number;
  value: number | null;
  pnl: number | null;
  /** Pourcentage (5 = 5 %). */
  pnlPct: number | null;
}

export interface Valorisation {
  lignes: LigneValorisee[];
  totalCost: number;
  equityValue: number;
  totalValue: number;
  totalPnl: number;
  /** Fraction (0,05 = 5 %). */
  totalPnlPct: number | null;
}

export function valoriser(
  positions: readonly PositionValorisable[],
  prix: Readonly<Record<string, number | null | undefined>>,
  liquidites: number | null,
): Valorisation {
  const lignes = positions.map((p) => {
    const last = prix[p.code] ?? null;
    const cost = p.quantite * p.prix_entree;
    const value = last != null ? p.quantite * last : null;
    const pnl = value != null ? value - cost : null;
    const pnlPct = cost > 0 && pnl != null ? (pnl / cost) * 100 : null;
    return { code: p.code, last, cost, value, pnl, pnlPct };
  });
  const totalCost = lignes.reduce((s, r) => s + r.cost, 0);
  const equityValue = lignes.reduce((s, r) => s + (r.value ?? 0), 0);
  const totalPnl = equityValue - totalCost;
  const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : null;
  return { lignes, totalCost, equityValue, totalValue: equityValue + (liquidites ?? 0), totalPnl, totalPnlPct };
}
