/**
 * Simulateur « Et si vous aviez investi… » — fonctions pures, testables.
 *
 * Hypothèses honnêtes :
 *  - nombre d'actions entier (pas de fractions à la BRVM), reliquat conservé en cash ;
 *  - dividendes versés pendant la période de détention ajoutés en cash
 *    (pas de réinvestissement automatique — affiché séparément) ;
 *  - aucune extrapolation : la simulation commence à la première séance
 *    disponible >= date demandée.
 */

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface DividendPoint {
  /** Date de paiement (ou ex_date à défaut). */
  date: string;
  /** Montant par action en FCFA. */
  montant: number;
}

export interface SimulationResult {
  /** Date effective de début (première séance disponible >= date demandée). */
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
  /** Nombre d'actions achetées (entier). */
  shares: number;
  /** Reliquat non investi (FCFA). */
  cashLeftover: number;
  /** Valeur des actions à la fin (shares × endPrice). */
  finalStockValue: number;
  /** Dividendes totaux perçus pendant la détention (FCFA). */
  totalDividends: number;
  /** Valeur totale finale = actions + dividendes + reliquat. */
  finalValue: number;
  /** Plus-value totale (finalValue - montant investi). */
  gain: number;
  /** Rendement total en % du montant investi. */
  totalReturnPct: number;
  /** Rendement annualisé en % (null si période < 30 jours). */
  annualizedReturnPct: number | null;
  /** Durée de détention en années (décimal). */
  years: number;
}

/**
 * Simule un investissement de `amount` FCFA dans la série `prices`
 * (triée par date croissante) à partir de `fromDate`.
 * Retourne null si la série ne permet pas la simulation (< 2 points après fromDate).
 */
export function simulateInvestment(
  amount: number,
  fromDate: string,
  prices: PricePoint[],
  dividends: DividendPoint[] = [],
): SimulationResult | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const usable = prices.filter((p) => p.date >= fromDate && p.close > 0);
  if (usable.length < 2) return null;

  const start = usable[0]!;
  const end = usable[usable.length - 1]!;

  const shares = Math.floor(amount / start.close);
  if (shares < 1) return null; // montant insuffisant pour une action

  const cashLeftover = amount - shares * start.close;
  const finalStockValue = shares * end.close;

  const totalDividends = dividends
    .filter((d) => d.date >= start.date && d.date <= end.date && d.montant > 0)
    .reduce((sum, d) => sum + d.montant * shares, 0);

  const finalValue = finalStockValue + totalDividends + cashLeftover;
  const gain = finalValue - amount;
  const totalReturnPct = (gain / amount) * 100;

  const ms = new Date(end.date).getTime() - new Date(start.date).getTime();
  const years = ms / (365.25 * 24 * 3600 * 1000);
  const annualizedReturnPct =
    years >= 30 / 365.25 ? (Math.pow(finalValue / amount, 1 / years) - 1) * 100 : null;

  return {
    startDate: start.date,
    endDate: end.date,
    startPrice: start.close,
    endPrice: end.close,
    shares,
    cashLeftover,
    finalStockValue,
    totalDividends,
    finalValue,
    gain,
    totalReturnPct,
    annualizedReturnPct,
    years,
  };
}
