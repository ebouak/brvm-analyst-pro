/**
 * Utilities for dividend calendar calculation and display.
 * Handles month generation, dividend assignment, filtering, and countdown logic.
 */

export interface DividendCalendarEvent {
  id: string;
  code: string;
  designation: string | null;
  secteur: string | null;
  taux: number | null; // rendement estimé (null si cours indisponible)
  ex_date: string; // ISO date YYYY-MM-DD
  payment_date: string; // ISO date YYYY-MM-DD
  cours_jour: number | null; // for rendement calculation
  rendement_pct: number | null; // pre-computed from montant/cours
  montant: number; // dividend amount in FCFA
}

export interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  dividends: DividendCalendarEvent[];
  isCurrentMonth: boolean;
}

/**
 * Generate all calendar days for a given month (6 weeks × 7 days = 42 days).
 * Includes padding from previous/next months.
 */
export function getMonthDays(year: number, month: number): CalendarDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon, ...
  const days: CalendarDay[] = [];

  // Adjust firstDay: 0 (Sunday) should become index 6 for week starting Monday
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  // Pad previous month's days (Monday start)
  if (adjustedFirstDay > 0) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(prevYear, prevMonth, daysInPrevMonth - i),
        dayOfMonth: daysInPrevMonth - i,
        dividends: [],
        isCurrentMonth: false,
      });
    }
  }

  // Current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      date: new Date(year, month, day),
      dayOfMonth: day,
      dividends: [],
      isCurrentMonth: true,
    });
  }

  // Pad next month's days (to complete 6 weeks)
  const remainingDays = 42 - days.length;
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    days.push({
      date: new Date(nextYear, nextMonth, day),
      dayOfMonth: day,
      dividends: [],
      isCurrentMonth: false,
    });
  }

  return days;
}

/**
 * Assign dividends to calendar days by matching ex_date.
 * Returns a new array with dividends populated in matching calendar days.
 */
export function assignDividends(
  days: CalendarDay[],
  dividends: DividendCalendarEvent[]
): CalendarDay[] {
  return days.map((day) => ({
    ...day,
    dividends: dividends.filter((div) => {
      const exDate = new Date(div.ex_date);
      return (
        exDate.getFullYear() === day.date.getFullYear() &&
        exDate.getMonth() === day.date.getMonth() &&
        exDate.getDate() === day.date.getDate()
      );
    }),
  }));
}

/**
 * Filter dividends by sector and minimum yield.
 * Returns filtered list of dividends.
 */
export function filterDividends(
  dividends: DividendCalendarEvent[],
  sector?: string,
  rendementMin?: number
): DividendCalendarEvent[] {
  return dividends.filter((div) => {
    if (sector && div.secteur !== sector) return false;
    if (rendementMin !== undefined && div.rendement_pct !== null) {
      if (div.rendement_pct < rendementMin) return false;
    }
    return true;
  });
}

/**
 * Generate countdown text relative to ex_date.
 * Format: "J-X avant détachement" or "Aujourd'hui" or "Dépassé"
 */
export function getCountdown(exDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(exDate);
  target.setHours(0, 0, 0, 0);

  const daysUntil = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return 'Dépassé';
  if (daysUntil === 0) return "Aujourd'hui";
  return `J-${daysUntil}`;
}

/**
 * Calculate estimated yield: (rendement_pct is already provided).
 * If not provided, calculate from montant/cours_jour.
 */
export function estimatedYield(dividend: DividendCalendarEvent): number | null {
  if (dividend.rendement_pct !== null) {
    return dividend.rendement_pct;
  }
  if (dividend.cours_jour && dividend.cours_jour > 0 && dividend.montant > 0) {
    return (dividend.montant / dividend.cours_jour) * 100;
  }
  return null;
}

/**
 * Extract unique sectors from dividends list, sorted alphabetically.
 */
export function getSectors(dividends: DividendCalendarEvent[]): string[] {
  const sectors = new Set(dividends.map((d) => d.secteur).filter((s): s is string => s != null));
  return Array.from(sectors).sort();
}

/**
 * Get unique codes from dividends, typically for filtering/grouping.
 */
export function getCodes(dividends: DividendCalendarEvent[]): string[] {
  const codes = new Set(dividends.map((d) => d.code));
  return Array.from(codes).sort();
}

/**
 * Filter dividends to future/upcoming only (ex_date >= today).
 */
export function getUpcomingDividends(dividends: DividendCalendarEvent[]): DividendCalendarEvent[] {
  const today = new Date().toISOString().split('T')[0];
  return dividends.filter((div) => div.ex_date >= today).sort((a, b) => a.ex_date.localeCompare(b.ex_date));
}

/**
 * Calculate min/max yield from dividends for range scaling.
 */
export function getYieldRange(
  dividends: DividendCalendarEvent[]
): { min: number | null; max: number | null } {
  const yields = dividends
    .map((d) => estimatedYield(d))
    .filter((y): y is number => y !== null);

  if (yields.length === 0) return { min: null, max: null };

  return {
    min: Math.min(...yields),
    max: Math.max(...yields),
  };
}
