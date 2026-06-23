// Cœur métier de l'outil Saisonnalité — fonctions PURES, testées (vitest).
// Aucune I/O ici.

export interface DailyClose { date: string; close: number }
export interface MonthlyReturn { year: number; month: number; ret: number }

export interface MonthStats {
  month: number;
  avgReturn: number;
  medianReturn: number;
  volatility: number | null; // null si n < 3 (non significatif)
  bullPct: number;
  n: number;
  reliability: 'high' | 'medium' | 'low';
}
export interface SeasonalityResult {
  matrix: MonthStats[];
  bestMonth: number | null;
  worstMonth: number | null;
  currentMonthBias: MonthStats | null;
  dataQuality: 'robust' | 'limited' | 'insufficient';
  yearsCovered: number;
}

/**
 * Daily closes → rendements mensuels (month-over-month).
 * ret(M) = dernier close de M / dernier close du mois coté PRÉCÉDENT - 1.
 * Un mois sans séance est omis (pas de rendement 0 fictif) ; on chaîne sur le
 * dernier mois réellement coté.
 */
export function monthlyReturnsFromPrices(prices: DailyClose[]): MonthlyReturn[] {
  const sorted = [...prices]
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastByMonth = new Map<string, { year: number; month: number; close: number }>();
  for (const p of sorted) {
    const year = Number(p.date.slice(0, 4));
    const month = Number(p.date.slice(5, 7));
    lastByMonth.set(p.date.slice(0, 7), { year, month, close: p.close });
  }
  const months = [...lastByMonth.values()];

  const out: MonthlyReturn[] = [];
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1]!;
    const cur = months[i]!;
    out.push({ year: cur.year, month: cur.month, ret: cur.close / prev.close - 1 });
  }
  return out;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
function stddev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
function reliabilityOf(n: number): MonthStats['reliability'] {
  return n >= 10 ? 'high' : n >= 5 ? 'medium' : 'low';
}

/**
 * Agrège les rendements mensuels par mois calendaire sur une fenêtre glissante.
 * Recalculable côté client à chaque changement de fenêtre.
 */
export function aggregateSeasonality(
  returns: MonthlyReturn[],
  windowYears: number,
  now: Date = new Date(),
): SeasonalityResult {
  const currentYear = now.getUTCFullYear();
  const minYear = currentYear - windowYears + 1;
  const windowed = returns.filter((r) => r.year >= minYear && r.year <= currentYear);

  const byMonth = new Map<number, number[]>();
  for (const r of windowed) {
    if (!byMonth.has(r.month)) byMonth.set(r.month, []);
    byMonth.get(r.month)!.push(r.ret);
  }

  const matrix: MonthStats[] = [];
  for (let month = 1; month <= 12; month++) {
    const xs = byMonth.get(month) ?? [];
    const n = xs.length;
    matrix.push({
      month,
      avgReturn: n ? xs.reduce((a, b) => a + b, 0) / n : 0,
      medianReturn: n ? median(xs) : 0,
      volatility: n >= 3 ? stddev(xs) : null,
      bullPct: n ? (xs.filter((x) => x > 0).length / n) * 100 : 0,
      n,
      reliability: reliabilityOf(n),
    });
  }

  const withData = matrix.filter((m) => m.n > 0);
  const bestMonth = withData.length
    ? withData.reduce((a, b) => (b.avgReturn > a.avgReturn ? b : a)).month : null;
  const worstMonth = withData.length
    ? withData.reduce((a, b) => (b.avgReturn < a.avgReturn ? b : a)).month : null;

  const yearsCovered = new Set(windowed.map((r) => r.year)).size;
  const dataQuality = yearsCovered >= 10 ? 'robust' : yearsCovered >= 5 ? 'limited' : 'insufficient';
  const currentMonth = now.getUTCMonth() + 1;
  const currentMonthBias = matrix.find((m) => m.month === currentMonth) ?? null;

  return { matrix, bestMonth, worstMonth, currentMonthBias, dataQuality, yearsCovered };
}
