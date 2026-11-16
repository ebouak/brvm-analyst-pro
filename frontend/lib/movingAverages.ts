import { smaSeries } from './indicators';

export interface DatedClose {
  code: string;
  date: string;
  close: number | null;
}

export type MovingAverageRegime = 'haussier' | 'baissier' | 'mixte' | 'incomplet';
export type MovingAverageCrossover = 'haussier' | 'baissier' | null;
export type MovingAverageRegimeHorizon = 'complet' | 'court_moyen' | 'incomplet';

export interface MovingAverageReading {
  date: string | null;
  close: number | null;
  observations: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  distance20Pct: number | null;
  distance50Pct: number | null;
  distance200Pct: number | null;
  slope20Pct: number | null;
  slope50Pct: number | null;
  slope200Pct: number | null;
  regime: MovingAverageRegime;
  regimeHorizon: MovingAverageRegimeHorizon;
  crossover: MovingAverageCrossover;
}

export interface MovingAverageChartPoint {
  date: string;
  close: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
}

export interface SectorBreadthReading {
  sma50Above: { above: number; total: number; percent: number | null };
  sma200Above: { above: number; total: number; percent: number | null };
}

const periods = [20, 50, 200] as const;
type Period = (typeof periods)[number];

function isValidClose(point: DatedClose): point is DatedClose & { close: number } {
  return point.close != null && Number.isFinite(point.close) && point.close > 0;
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
}

function orderedThrough(points: DatedClose[], asOfDate?: string): DatedClose[] {
  const dated = points
    .filter((point) => point.date <= (asOfDate ?? '9999-12-31'))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  return dated;
}

export function buildMovingAverageChart(
  points: DatedClose[],
  asOfDate?: string,
): MovingAverageChartPoint[] {
  if (asOfDate !== undefined && !isValidDate(asOfDate)) return [];

  const valid = points
    .filter((point) => isValidDate(point.date) && (asOfDate === undefined || point.date <= asOfDate))
    .filter(isValidClose)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const closes = valid.map((point) => point.close);
  const averages: Record<Period, (number | null)[]> = {
    20: smaSeries(closes, 20),
    50: smaSeries(closes, 50),
    200: smaSeries(closes, 200),
  };

  return valid
    .map((point, index) => ({
      date: point.date,
      close: point.close,
      sma20: averages[20][index] ?? null,
      sma50: averages[50][index] ?? null,
      sma200: averages[200][index] ?? null,
    }))
    .slice(-120);
}

export function describeMovingAveragePosition(reading: MovingAverageReading): string {
  const positions = [
    { period: 20, distance: reading.distance20Pct },
    { period: 50, distance: reading.distance50Pct },
    { period: 200, distance: reading.distance200Pct },
  ] as const;
  const available = positions.filter(
    (position): position is (typeof positions)[number] & { distance: number } =>
      position.distance != null && Number.isFinite(position.distance),
  );
  const missing = positions.filter(
    (position) => position.distance == null || !Number.isFinite(position.distance),
  );

  if (available.length === 0) {
    return `Lecture incomplète : aucune donnée de position n’est disponible pour les moyennes mobiles à ${missing.map((item) => item.period).join(', ')} séances.`;
  }

  const groups = {
    above: available.filter((item) => item.distance > 0).map((item) => item.period),
    below: available.filter((item) => item.distance < 0).map((item) => item.period),
    equal: available.filter((item) => item.distance === 0).map((item) => item.period),
  };
  const label = (periods: number[]) =>
    periods.map((period) => `la moyenne mobile à ${period} séances`).join(', ');
  const populatedGroups = [groups.above, groups.below, groups.equal].filter((group) => group.length > 0);
  let summary: string;

  if (populatedGroups.length > 1) {
    const positionsText = [
      groups.above.length > 0 ? `au-dessus de ${label(groups.above)}` : null,
      groups.below.length > 0 ? `sous ${label(groups.below)}` : null,
      groups.equal.length > 0 ? `au niveau de ${label(groups.equal)}` : null,
    ].filter((part): part is string => part != null);
    summary = `La position du cours est contrastée selon les horizons : ${positionsText.join('; ')}.`;
  } else if (groups.above.length > 0) {
    summary = `Le cours se situe au-dessus de ${label(groups.above)}.`;
  } else if (groups.below.length > 0) {
    summary = `Le cours se situe sous ${label(groups.below)}.`;
  } else {
    summary = `Le cours se situe au niveau de ${label(groups.equal)}.`;
  }

  if (missing.length === 0) return summary;
  const missingHorizons = missing.map((item) => item.period).join(', ');
  const noun = missing.length === 1 ? 'la moyenne mobile' : 'les moyennes mobiles';
  return `${summary} Lecture incomplète : données indisponibles pour ${noun} à ${missingHorizons} séances.`;
}

function safePercent(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) return null;
  return (numerator / denominator - 1) * 100;
}

function classifyRegime(
  close: number | null,
  sma20: number | null,
  sma50: number | null,
  sma200: number | null,
): { regime: MovingAverageRegime; regimeHorizon: MovingAverageRegimeHorizon } {
  if (close == null || sma20 == null || sma50 == null) {
    return { regime: 'incomplet', regimeHorizon: 'incomplet' };
  }

  const values = sma200 == null ? [close, sma20, sma50] : [close, sma20, sma50, sma200];
  const regimeHorizon: MovingAverageRegimeHorizon = sma200 == null ? 'court_moyen' : 'complet';
  const hausse = values.every((value, index) => index === 0 || values[index - 1]! > value);
  const baisse = values.every((value, index) => index === 0 || values[index - 1]! < value);

  if (hausse) return { regime: 'haussier', regimeHorizon };
  if (baisse) return { regime: 'baissier', regimeHorizon };
  return { regime: 'mixte', regimeHorizon };
}

function currentCrossover(
  ordered: DatedClose[],
  valid: (DatedClose & { close: number })[],
  averages: Record<Period, (number | null)[]>,
  asOfDate?: string,
): MovingAverageCrossover {
  const latest = ordered[ordered.length - 1];
  if (!latest || latest.date !== (asOfDate ?? latest.date)) return null;
  if (ordered.length < 2 || !isValidClose(ordered[ordered.length - 1]!)) return null;
  if (!isValidClose(ordered[ordered.length - 2]!)) return null;
  if (valid.length < 50) return null;

  const currentIndex = valid.length - 1;
  const previous20 = averages[20][currentIndex - 1];
  const previous50 = averages[50][currentIndex - 1];
  const current20 = averages[20][currentIndex];
  const current50 = averages[50][currentIndex];
  if (previous20 == null || previous50 == null || current20 == null || current50 == null) return null;
  if (previous20 <= previous50 && current20 > current50) return 'haussier';
  if (previous20 >= previous50 && current20 < current50) return 'baissier';
  return null;
}

export function analyzeMovingAverages(points: DatedClose[], asOfDate?: string): MovingAverageReading {
  const ordered = orderedThrough(points, asOfDate);
  const valid = ordered.filter(isValidClose);
  const closes = valid.map((point) => point.close);
  const currentIndex = closes.length - 1;
  const averages: Record<Period, (number | null)[]> = {
    20: smaSeries(closes, 20),
    50: smaSeries(closes, 50),
    200: smaSeries(closes, 200),
  };
  const averageAt = (period: Period): number | null => averages[period][currentIndex] ?? null;
  const sma20 = averageAt(20);
  const sma50 = averageAt(50);
  const sma200 = averageAt(200);
  const close = valid[currentIndex]?.close ?? null;
  const slopeAt = (period: Period): number | null => {
    if (currentIndex < 0) return null;
    const previous = averages[period][currentIndex - 5];
    const current = averages[period][currentIndex];
    return current == null || previous == null ? null : safePercent(current, previous);
  };
  const regime = classifyRegime(close, sma20, sma50, sma200);

  return {
    date: valid[currentIndex]?.date ?? null,
    close,
    observations: valid.length,
    sma20,
    sma50,
    sma200,
    distance20Pct: close == null || sma20 == null ? null : safePercent(close, sma20),
    distance50Pct: close == null || sma50 == null ? null : safePercent(close, sma50),
    distance200Pct: close == null || sma200 == null ? null : safePercent(close, sma200),
    slope20Pct: slopeAt(20),
    slope50Pct: slopeAt(50),
    slope200Pct: slopeAt(200),
    ...regime,
    crossover: currentCrossover(ordered, valid, averages, asOfDate),
  };
}

function breadthForPeriod(
  series: DatedClose[][],
  asOfDate: string,
  period: 50 | 200,
): SectorBreadthReading['sma50Above'] {
  let above = 0;
  let total = 0;

  for (const member of series) {
    const ordered = orderedThrough(member, asOfDate);
    const valid = ordered.filter(isValidClose);
    const latest = valid[valid.length - 1];
    if (latest?.date !== asOfDate) continue;

    const closes = valid.map((point) => point.close);
    const average = smaSeries(closes, period).at(-1) ?? null;
    if (average == null) continue;

    total += 1;
    if (latest.close > average) above += 1;
  }

  return { above, total, percent: total < 3 ? null : (above / total) * 100 };
}

export function calculateSectorBreadth(series: DatedClose[][], asOfDate: string): SectorBreadthReading {
  return {
    sma50Above: breadthForPeriod(series, asOfDate, 50),
    sma200Above: breadthForPeriod(series, asOfDate, 200),
  };
}
