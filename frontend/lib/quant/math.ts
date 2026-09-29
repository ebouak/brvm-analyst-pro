export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
export function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
export function stddev(arr: number[]): number | null {
  if (arr.length < 2) return null;
  const m = mean(arr)!;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}
export function percentileRank(sorted: number[], value: number): number {
  // sorted asc; rank = (# < value + 0.5 * # == value) / N * 100
  let less = 0, eq = 0;
  for (const x of sorted) { if (x < value) less++; else if (x === value) eq++; }
  return ((less + 0.5 * eq) / sorted.length) * 100;
}
export function quantile(sortedAsc: number[], p: number): number {
  // p in [0,100]
  if (sortedAsc.length === 0) return NaN;
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const t = idx - lo;
  return sortedAsc[lo] * (1 - t) + sortedAsc[hi] * t;
}
export function annualizedVolatility(dailyReturns: number[]): number | null {
  const sd = stddev(dailyReturns);
  if (sd == null) return null;
  return sd * Math.sqrt(252);
}
export function dailyReturnsFromCloses(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1], cur = closes[i];
    if (prev > 0 && isFiniteNumber(cur) && isFiniteNumber(prev)) out.push(cur / prev - 1);
  }
  return out;
}
