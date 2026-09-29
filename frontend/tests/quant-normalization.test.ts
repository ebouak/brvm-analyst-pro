import { describe, it, expect } from 'vitest';
import { calculatePercentile, winsorize, percentileWithFallback } from '@/lib/quant/normalization';

describe('normalization', () => {
  it('percentile croissant higherIsBetter=true', () => {
    expect(calculatePercentile(10, [1,5,10,15,20], true)).toBeGreaterThan(40);
  });
  it('percentile inversé lower is better', () => {
    const a = calculatePercentile(2, [1,2,5,10], false);
    const b = calculatePercentile(10, [1,2,5,10], false);
    expect(a!).toBeGreaterThan(b!);
  });
  it('null => null', () => { expect(calculatePercentile(null, [1,2,3], true)).toBeNull(); });
  it('bornes 0..100', () => {
    const p = calculatePercentile(100, [1,2,3,100], true)!; expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(100);
  });
  it('winsorize 5-95', () => {
    const { winsorized } = winsorize([1,2,3,4,5,1000], 5, 95); expect(Math.max(...winsorized)).toBeLessThan(1000);
  });
  it('fallback sector insuffisant => global', () => {
    const r = percentileWithFallback(10, [1,2], [1,5,10,15,20], true, 5); expect(r.scope).toBe('global');
  });
});
