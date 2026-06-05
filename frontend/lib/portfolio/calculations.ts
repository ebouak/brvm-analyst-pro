/**
 * Portfolio performance calculations using Modified Dietz formula.
 * All functions are pure (no side effects, fully testable).
 * Performance values are expressed as decimals (e.g., 0.1850 for 18.50%).
 */

/**
 * Get the number of days in a given month.
 * @param date Date to determine month from
 * @returns Number of days in that month (28–31)
 */
export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Calculate Dietz weight for a mid-month cash flow.
 *
 * Weight formula: (D - di) / D
 * - D = days in month
 * - di = day of flux
 *
 * Example: flux on 30-Jan in 31-day month → (31-30)/31 ≈ 0.0322
 * Flow at month-end has weight ≈ 0, flow at month-start has weight ≈ 1
 *
 * @param dateFlux Date of the cash flow
 * @param moisFin End date of the month (for day count reference)
 * @returns Weight between 0 and 1
 */
export function calculateWeight(dateFlux: Date, moisFin: Date): number {
  const D = getDaysInMonth(moisFin);
  const di = dateFlux.getDate();
  return (D - di) / D;
}

/**
 * Apply Dietz weight to a cash flow amount.
 * @param montant Cash flow amount (apport or retrait, can be negative)
 * @param poids Dietz weight (0–1)
 * @returns Weighted amount
 */
export function calculateWeightedFlow(montant: number, poids: number): number {
  return montant * poids;
}

/**
 * Calculate monthly performance using Modified Dietz formula.
 *
 * Formula:
 *   perf = (VF - VI - totalApports + totalRetraits)
 *           ─────────────────────────────────────────
 *           (VI + sum(montant_i × poids_i))
 *
 * Where:
 * - VF = Final value
 * - VI = Initial value
 * - totalApports = Sum of deposits (positive)
 * - totalRetraits = Sum of withdrawals (positive)
 * - sum(montant_i × poids_i) = Sum of weighted flows
 *
 * @param valeurFinale Final portfolio value
 * @param valeurInitiale Initial portfolio value
 * @param movements Array of movements with { montant, poids }
 * @returns Performance as decimal (e.g., 0.1147 for +11.47%)
 */
export function calculateMonthlyPerformance(
  valeurFinale: number,
  valeurInitiale: number,
  movements: Array<{ montant: number; poids: number }>
): number {
  // Total weighted flows
  const totalWeightedFlows = movements.reduce((sum, mov) => sum + mov.montant * mov.poids, 0);

  // Numerator: VF - VI - (all flows)
  // Note: flows are already positive/negative in the array
  const totalFlows = movements.reduce((sum, mov) => sum + mov.montant, 0);
  const numerator = valeurFinale - valeurInitiale - totalFlows;

  // Denominator: VI + weighted flows
  const denominator = valeurInitiale + totalWeightedFlows;

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * Calculate cumulative index after a month's performance.
 *
 * Formula: indexPrecedent × (1 + perfMensuelle)
 *
 * Example: 100 × (1 + 0.18) = 118
 *
 * @param indexPrecedent Previous month's index (or 100 for first month)
 * @param perfMensuelle Monthly performance as decimal (e.g., 0.18)
 * @returns New index value
 */
export function calculateIndex(
  indexPrecedent: number,
  perfMensuelle: number
): number {
  return indexPrecedent * (1 + perfMensuelle);
}

/**
 * Calculate total cumulative performance from base index.
 *
 * Formula: (currentIndex / 100) - 1
 * Assumes base index = 100
 *
 * @param currentIndex Current index value
 * @returns Total performance as decimal
 */
export function calculateTotalPerformance(currentIndex: number): number {
  return currentIndex / 100 - 1;
}

/**
 * Calculate year-to-date performance.
 *
 * Formula: (currentIndex / startOfYearIndex) - 1
 *
 * @param currentIndex Current index value
 * @param startOfYearIndex Index value at start of year
 * @returns YTD performance as decimal
 */
export function calculateYTDPerformance(
  currentIndex: number,
  startOfYearIndex: number
): number {
  if (startOfYearIndex === 0) {
    return 0;
  }
  return currentIndex / startOfYearIndex - 1;
}

/**
 * Calculate pure gains in FCFA (portfolio gain/loss).
 *
 * Formula: VF - (VI + totalApports - totalRetraits)
 *
 * This is the absolute gain/loss, independent of performance metrics.
 *
 * @param valeurFinale Final portfolio value
 * @param valeurInitiale Initial portfolio value
 * @param totalApports Total deposits
 * @param totalRetraits Total withdrawals
 * @returns Gain/loss in FCFA
 */
export function calculatePureGains(
  valeurFinale: number,
  valeurInitiale: number,
  totalApports: number,
  totalRetraits: number
): number {
  const investedCapital = valeurInitiale + totalApports - totalRetraits;
  return valeurFinale - investedCapital;
}

/**
 * Format an amount in FCFA with proper spacing and suffix.
 *
 * Format: "1 908 295 FCFA" (space as thousands separator)
 * Uses French locale (fr-FR) for number formatting.
 *
 * @param amount Amount in FCFA
 * @returns Formatted string, e.g., "1 908 295 FCFA"
 */
export function formatFCFA(amount: number): string {
  const formatter = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${formatter.format(amount)} FCFA`;
}

/**
 * Format a percentage with optional decimals and sign.
 *
 * Always shows sign (+ or -).
 * Default precision: 2 decimals.
 *
 * Examples:
 *   0.1850 with 2 decimals → "+18.50%"
 *   -0.0320 with 2 decimals → "-3.20%"
 *   0.1850 with 1 decimal → "+18.5%"
 *
 * @param value Performance as decimal (e.g., 0.1850)
 * @param decimals Number of decimal places (default 2)
 * @returns Formatted percentage string with sign
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  const percentage = value * 100;
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(decimals)}%`;
}

/**
 * Movement data for calculations.
 */
export interface Movement {
  date: Date;
  montant: number; // positive for deposits, negative for withdrawals
  poids?: number; // pre-calculated Dietz weight (optional)
}

/**
 * Monthly tracking entry for recalculation.
 */
export interface MonthlyTrackingEntry {
  userId: string;
  year: number;
  month: number;
  valeur_initiale: number;
  valeur_finale: number;
  total_apports: number;
  total_retraits: number;
  perf_mensuelle: number; // decimal
  index_tracking: number;
  total_perf: number; // decimal
  ytd_perf: number; // decimal
  gains_purs: number;
  updated_at?: string;
}

/**
 * Recalculate all portfolio monthly tracking entries for a user.
 *
 * This is the cascading calculation that must be run after any mutation
 * (deposit, withdrawal, value update, etc.) to ensure all months are
 * consistent and cumulative.
 *
 * Process:
 * 1. Fetch all portfolio_monthly_tracking and portfolio_movements for userId
 * 2. Sort entries by (year, month) ASC
 * 3. For each month:
 *    - Fetch movements for that month
 *    - Calculate weights for mid-month flows
 *    - Run calculateMonthlyPerformance
 *    - Run calculateIndex (cumulative from previous)
 *    - Run calculateTotalPerformance and calculateYTDPerformance
 *    - Upsert into database
 * 4. Return when complete
 *
 * Note: This is a stub signature. Full implementation requires Supabase client
 * and database access. Pure calculation logic above is independent.
 *
 * @param userId User ID
 * @param supabaseClient Supabase client with full access
 */
export async function recalculateAllTracking(
  userId: string,
  supabaseClient: any // SupabaseClient type (to avoid circular dependency)
): Promise<void> {
  // Stub: Database access would be implemented here.
  // Core calculation logic is in the functions above (pure, testable).
  console.log(`recalculateAllTracking stub: userId=${userId}`);
  // TODO: Implement cascading recalculation with supabaseClient
}
