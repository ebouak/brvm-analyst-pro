import { isFiniteNumber, clamp, quantile } from './math';

/** Percentile 0..100 (entier), 100 = meilleur. higherIsBetter=false => valeur faible = meilleur. */
export function calculatePercentile(value: number | null | undefined, values: (number | null | undefined)[], higherIsBetter: boolean): number | null {
  if (value == null || !isFiniteNumber(value)) return null;
  const clean = values.filter((v): v is number => v != null && isFiniteNumber(v));
  if (clean.length < 2) return null;
  // Inverser si lower is better
  const mapped = higherIsBetter ? clean : clean.map((v) => -v);
  const vMapped = higherIsBetter ? value : -value;
  const sorted = [...mapped].sort((a, b) => a - b);
  let less = 0, eq = 0;
  for (const x of sorted) { if (x < vMapped) less++; else if (x === vMapped) eq++; }
  const pct = ((less + 0.5 * eq) / sorted.length) * 100;
  return clamp(Math.round(pct), 0, 100);
}

export function winsorize(values: number[], lowerP = 5, upperP = 95): { winsorized: number[]; lo: number; hi: number } {
  const clean = values.filter(isFiniteNumber);
  if (clean.length === 0) return { winsorized: [], lo: NaN, hi: NaN };
  const sorted = [...clean].sort((a, b) => a - b);
  const lo = quantile(sorted, lowerP);
  const hi = quantile(sorted, upperP);
  return { winsorized: clean.map((v) => clamp(v, lo, hi)), lo, hi };
}

export function percentileWithFallback(
  value: number | null | undefined,
  sectorValues: (number | null | undefined)[],
  globalValues: (number | null | undefined)[],
  higherIsBetter: boolean,
  minSector = 5,
): { percentile: number | null; scope: 'sector' | 'global' | 'insufficient'; n: number } {
  const sectorClean = sectorValues.filter((v): v is number => v != null && isFiniteNumber(v));
  if (sectorClean.length >= minSector) {
    return { percentile: calculatePercentile(value, sectorClean, higherIsBetter), scope: 'sector', n: sectorClean.length };
  }
  const globalClean = globalValues.filter((v): v is number => v != null && isFiniteNumber(v));
  if (globalClean.length >= 2) {
    return { percentile: calculatePercentile(value, globalClean, higherIsBetter), scope: 'global', n: globalClean.length };
  }
  return { percentile: null, scope: 'insufficient', n: globalClean.length };
}
