/**
 * Lecture macro d'une matière première et de son impact sur les producteurs
 * BRVM (méthodes d'analyste matières premières).
 *
 * Principe : un producteur (PALC, SAPH, SUCRIVOIRE…) voit ses marges
 * s'améliorer quand le prix de son sous-jacent monte. La lecture est pondérée
 * par le signe de la corrélation effectivement observée.
 *
 * Fonctions pures et testables.
 */

export interface CommodityMacro {
  change3m: number | null;  // fraction
  change12m: number | null;
  trend: 'hausse' | 'baisse' | 'stable';
  reading: string;
}

function changeOver(prices: number[], periods: number): number | null {
  if (prices.length <= periods) return null;
  const last = prices[prices.length - 1]!;
  const prev = prices[prices.length - 1 - periods]!;
  return prev !== 0 ? (last - prev) / prev : null;
}

export function readCommodityMacro(
  prices: number[],
  commodityLabel: string,
  correlation: number | null,
): CommodityMacro {
  const change3m = changeOver(prices, 3);
  const change12m = changeOver(prices, 12);

  let trend: CommodityMacro['trend'] = 'stable';
  if (change12m != null) {
    if (change12m > 0.05) trend = 'hausse';
    else if (change12m < -0.05) trend = 'baisse';
  }

  const pct = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);

  let impact = '';
  if (trend !== 'stable') {
    const favorable = trend === 'hausse';
    // Corrélation positive forte => le cours de l'action suit la matière.
    const aligned = correlation != null && correlation > 0.3;
    if (favorable) {
      impact = aligned
        ? ` Marges des producteurs orientées favorablement, et le cours de l'action tend à suivre (corrélation ${correlation!.toFixed(2)}).`
        : ' Marges des producteurs plutôt favorables, mais le lien avec le cours de l\'action reste faible sur la période.';
    } else {
      impact = aligned
        ? ` Pression sur les marges des producteurs, susceptible de peser sur le cours (corrélation ${correlation!.toFixed(2)}).`
        : ' Pression sur les marges des producteurs, mais le lien avec le cours de l\'action reste faible sur la période.';
    }
  }

  const reading =
    `${commodityLabel} : ${pct(change12m)} sur 12 mois (${pct(change3m)} sur 3 mois), tendance ${trend}.${impact}`;

  return { change3m, change12m, trend, reading };
}
