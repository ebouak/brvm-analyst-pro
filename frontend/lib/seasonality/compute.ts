// Cœur métier de l'outil Saisonnalité — fonctions PURES, testées (vitest).
// Aucune I/O ici. Spec : docs/superpowers/specs/2026-11-10-saisonnalite-v2.md (lot 1).

export interface DailyClose { date: string; close: number }
export interface MonthlyReturn {
  year: number;
  month: number;
  ret: number;
  /** Mois sans échange enjambés par ce rendement. > 0 : écarté des statistiques. */
  gapMonths: number;
}

/**
 * Fiabilité d'une cellule, calculée, jamais écrite à la main.
 * `hasard` = régularité non distinguable du hasard (la majorité des cellules).
 */
export type Verdict = 'etabli' | 'indicatif' | 'hasard';

export interface MonthStats {
  month: number;
  avgReturn: number;
  medianReturn: number;
  volatility: number | null; // écart-type d'échantillon ; null si n < 3
  bullPct: number;
  n: number;
  verdict: Verdict;
}
export interface SeasonalityResult {
  matrix: MonthStats[];
  /** Mois à la médiane la plus haute parmi les cellules au moins indicatives ; null = aucun mois ne se détache. */
  bestMonth: number | null;
  worstMonth: number | null;
  currentMonthBias: MonthStats | null;
  dataQuality: 'robust' | 'limited' | 'insufficient';
  yearsCovered: number;
}

/**
 * Daily closes → rendements mensuels (month-over-month).
 * ret(M) = dernier close de M / dernier close du mois coté PRÉCÉDENT - 1.
 *
 * - Le mois de `asOf` n'est jamais rendu : inachevé, il n'est pas un mois.
 * - Un mois sans séance ne produit pas de rendement ; le rendement du mois de
 *   reprise porte `gapMonths` > 0 (il cumule plusieurs mois) et les agrégats
 *   l'écartent.
 */
export function monthlyReturnsFromPrices(
  prices: DailyClose[],
  { asOf = new Date() }: { asOf?: Date } = {},
): MonthlyReturn[] {
  const moisEnCours = asOf.toISOString().slice(0, 7);
  const sorted = [...prices]
    .filter((p) => Number.isFinite(p.close) && p.close > 0 && p.date.slice(0, 7) < moisEnCours)
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
    const gapMonths = (cur.year - prev.year) * 12 + (cur.month - prev.month) - 1;
    out.push({ year: cur.year, month: cur.month, ret: cur.close / prev.close - 1, gapMonths });
  }
  return out;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** Écart-type d'échantillon (n − 1). */
function stddev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/**
 * Seuil de Student bilatéral à 5 % corrigé pour 12 mois (α = 0,05 / 12), par
 * degrés de liberté de 9 à 30. La spec donnait 3,1 pour tout n ; à n = 10 le
 * seuil exact est 3,81, et 3,1 laissait passer ~8 % de matrices de pur bruit.
 */
const T_CORRIGE = [3.81, 3.7, 3.61, 3.53, 3.47, 3.42, 3.38, 3.34, 3.31, 3.28, 3.26, 3.24, 3.22, 3.2, 3.19, 3.17, 3.16, 3.15, 3.14, 3.12, 3.12, 3.11];
const seuilCorrige = (n: number) => T_CORRIGE[n - 10] ?? 3.1;

/**
 * Verdict d'une cellule (un mois calendaire d'une valeur).
 * - `etabli` : n ≥ 10, médiane de même signe dans les deux moitiés chronologiques,
 *   moyenne et médiane de même signe, part de hausses ≤ 30 % ou ≥ 70 %, et |t|
 *   au-dessus du seuil corrigé pour 12 mois.
 * - `indicatif` : n ≥ 5, moyenne et médiane de même signe, |t| ≥ 2, et au moins
 *   trois des quatre critères (n ≥ 10, moitiés, signes, part de hausses).
 * - `hasard` : le reste. Moyenne et médiane de signe opposé : toujours `hasard`.
 */
export function verdictCellule(xs: { year: number; ret: number }[]): Verdict {
  const n = xs.length;
  if (n < 5) return 'hasard';
  const chrono = [...xs].sort((a, b) => a.year - b.year).map((x) => x.ret);
  const moy = mean(chrono);
  const med = median(chrono);
  const signesAccord = moy !== 0 && med !== 0 && Math.sign(moy) === Math.sign(med);
  if (!signesAccord) return 'hasard';

  const moitie = Math.floor(n / 2);
  const m1 = median(chrono.slice(0, moitie));
  const m2 = median(chrono.slice(moitie));
  const moitiesAccord = m1 !== 0 && Math.sign(m1) === Math.sign(m2);
  const partHausses = chrono.filter((x) => x > 0).length / n;
  const partNette = partHausses <= 0.3 || partHausses >= 0.7;
  const sd = stddev(chrono);
  const t = sd === 0 ? Infinity : Math.abs(moy) / (sd / Math.sqrt(n));

  if (n >= 10 && moitiesAccord && partNette && t >= seuilCorrige(n)) return 'etabli';
  const criteres = [n >= 10, moitiesAccord, signesAccord, partNette].filter(Boolean).length;
  return criteres >= 3 && t >= 2 ? 'indicatif' : 'hasard';
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
  const windowed = returns.filter((r) => r.year >= minYear && r.year <= currentYear && !(r.gapMonths > 0));

  const byMonth = new Map<number, { year: number; ret: number }[]>();
  for (const r of windowed) {
    if (!byMonth.has(r.month)) byMonth.set(r.month, []);
    byMonth.get(r.month)!.push({ year: r.year, ret: r.ret });
  }

  const matrix: MonthStats[] = [];
  for (let month = 1; month <= 12; month++) {
    const cell = byMonth.get(month) ?? [];
    const xs = cell.map((c) => c.ret);
    const n = xs.length;
    matrix.push({
      month,
      avgReturn: n ? mean(xs) : 0,
      medianReturn: n ? median(xs) : 0,
      volatility: n >= 3 ? stddev(xs) : null,
      bullPct: n ? (xs.filter((x) => x > 0).length / n) * 100 : 0,
      n,
      verdict: verdictCellule(cell),
    });
  }

  // Un mois n'est nommé que s'il est au moins indicatif ; sinon rien ne se détache.
  const fiables = matrix.filter((m) => m.verdict !== 'hasard');
  const forts = fiables.filter((m) => m.medianReturn > 0);
  const faibles = fiables.filter((m) => m.medianReturn < 0);
  const bestMonth = forts.length ? forts.reduce((a, b) => (b.medianReturn > a.medianReturn ? b : a)).month : null;
  const worstMonth = faibles.length ? faibles.reduce((a, b) => (b.medianReturn < a.medianReturn ? b : a)).month : null;

  const yearsCovered = new Set(windowed.map((r) => r.year)).size;
  const dataQuality = yearsCovered >= 10 ? 'robust' : yearsCovered >= 5 ? 'limited' : 'insufficient';
  const currentMonth = now.getUTCMonth() + 1;
  const currentMonthBias = matrix.find((m) => m.month === currentMonth) ?? null;

  return { matrix, bestMonth, worstMonth, currentMonthBias, dataQuality, yearsCovered };
}

/**
 * Rendement mensuel du marché : moyenne équipondérée des valeurs cotées, chaque
 * rendement écrêté à ±30 % (un saut isolé ne fait pas la saison du marché).
 * Les rendements qui enjambent un mois sans échange sont écartés.
 */
export function marketMonthlyReturns(parValeur: MonthlyReturn[][], ecretage = 0.3): MonthlyReturn[] {
  const parMois = new Map<string, { year: number; month: number; somme: number; n: number }>();
  for (const serie of parValeur) {
    for (const r of serie) {
      if (r.gapMonths > 0 || !Number.isFinite(r.ret)) continue;
      const cle = `${r.year}-${String(r.month).padStart(2, '0')}`;
      const m = parMois.get(cle) ?? { year: r.year, month: r.month, somme: 0, n: 0 };
      m.somme += Math.max(-ecretage, Math.min(ecretage, r.ret));
      m.n++;
      parMois.set(cle, m);
    }
  }
  return [...parMois.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, m]) => ({ year: m.year, month: m.month, ret: m.somme / m.n, gapMonths: 0 }));
}
