// Traduit des POIDS CIBLES (issus de l'optimiseur ou équipondérés) en ORDRES
// concrets : combien acheter / vendre par ligne, en FCFA et en nombre d'actions.
// Long-only (pas de vente à découvert à la BRVM) : les poids négatifs sont
// ramenés à 0 puis renormalisés. Fonction pure, testable. N'invente rien :
// tout est dérivé des valeurs/cours réels passés en entrée.

export interface RebalancePosition {
  code: string;
  value: number; // valeur de marché actuelle (FCFA)
  price: number; // dernier cours (FCFA/action)
}

export interface RebalanceTrade {
  code: string;
  currentWeight: number; // 0..1
  targetWeight: number; // 0..1 (long-only, renormalisé)
  driftPct: number; // (target - current) en points de %
  deltaValue: number; // FCFA à investir (+) ou désinvestir (−)
  deltaShares: number; // nb d'actions à acheter (+) / vendre (−), arrondi
  action: 'acheter' | 'vendre' | 'conserver';
}

/** Normalise des poids en long-only (négatifs → 0) sommant à 1. */
export function longOnly(weights: number[]): number[] {
  const clipped = weights.map((w) => (w > 0 ? w : 0));
  const sum = clipped.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 1 / weights.length); // repli équipondéré
  return clipped.map((w) => w / sum);
}

/** Poids équipondérés pour n lignes. */
export function equalWeights(n: number): number[] {
  return Array.from({ length: n }, () => 1 / n);
}

/**
 * @param positions  lignes détenues (valeur + cours).
 * @param targetWeights  poids cibles alignés sur `positions` (même ordre).
 * @param bandPct  bande de tolérance (en points de %) : en deçà → « conserver ».
 */
export function rebalanceTrades(
  positions: RebalancePosition[],
  targetWeights: number[],
  bandPct = 3,
): RebalanceTrade[] {
  const total = positions.reduce((a, p) => a + p.value, 0);
  if (total <= 0 || positions.length === 0) return [];
  const targets = longOnly(targetWeights);

  return positions.map((p, i) => {
    const currentWeight = p.value / total;
    const targetWeight = targets[i] ?? 0;
    const driftPts = (targetWeight - currentWeight) * 100;
    const deltaValue = targetWeight * total - p.value;
    const deltaShares = p.price > 0 ? Math.round(deltaValue / p.price) : 0;
    const action: RebalanceTrade['action'] =
      Math.abs(driftPts) < bandPct || deltaShares === 0
        ? 'conserver'
        : deltaValue > 0
          ? 'acheter'
          : 'vendre';
    return { code: p.code, currentWeight, targetWeight, driftPct: driftPts, deltaValue, deltaShares, action };
  });
}
