import { describe, expect, it } from 'vitest';
import { formatBookDate, formatSpread } from './bookPresentation';

describe('formatBookDate', () => {
  it('formats a dated BOC session without shifting the calendar day', () => {
    expect(formatBookDate('2026-11-13')).toContain('13');
  });
});

describe('formatSpread', () => {
  it('calculates the spread only from two positive, ordered limits', () => {
    expect(formatSpread({ buyPrice: 100, sellPrice: 105 })).toEqual({
      amount: 5,
      percent: 5,
    });
  });

  it.each([
    { buyPrice: null, sellPrice: 105 },
    { buyPrice: 100, sellPrice: null },
    { buyPrice: 0, sellPrice: 105 },
    { buyPrice: 110, sellPrice: 105 },
  ])('does not present an unavailable or crossed spread as valid', (book) => {
    expect(formatSpread(book)).toBeNull();
  });
});
