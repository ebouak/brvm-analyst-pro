/**
 * Normalize a Date to 'YYYY-MM-DD' string for Supabase
 * Used when sending date_marche to database
 *
 * @example
 * const dateStr = toDateOnly(new Date('2026-07-07T14:30:00Z')); // '2026-07-07'
 */
export function toDateOnly(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Convert ISO datetime string to Date object
 * Used when reading created_at/updated_at from database
 *
 * @example
 * const date = toDate('2026-07-07T14:30:00Z'); // Date object
 */
export function toDate(isoString: string): Date {
  return new Date(isoString);
}
