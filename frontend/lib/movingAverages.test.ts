import { describe, expect, it } from 'vitest';
import { analyzeMovingAverages, calculateSectorBreadth } from './movingAverages';
import type { DatedClose } from './movingAverages';

function series(length: number, closeAt: (index: number) => number | null): DatedClose[] {
  return Array.from({ length }, (_, index) => ({
    code: 'TEST',
    date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
    close: closeAt(index),
  }));
}

describe('analyzeMovingAverages', () => {
  it('requires 20, 50, and 200 valid session closes for each average', () => {
    expect(analyzeMovingAverages(series(19, () => 100)).sma20).toBeNull();
    expect(analyzeMovingAverages(series(20, () => 100)).sma20).toBe(100);
    expect(analyzeMovingAverages(series(49, () => 100)).sma50).toBeNull();
    expect(analyzeMovingAverages(series(50, () => 100)).sma50).toBe(100);
    expect(analyzeMovingAverages(series(199, () => 100)).sma200).toBeNull();
    expect(analyzeMovingAverages(series(200, () => 100)).sma200).toBe(100);
  });

  it('ignores null, non-finite, and non-positive closes', () => {
    const points = series(23, (index) => index < 19 ? 100 : index === 19 ? null : index === 20 ? 0 : index === 21 ? -1 : Infinity);
    const reading = analyzeMovingAverages(points);

    expect(reading.observations).toBe(19);
    expect(reading.sma20).toBeNull();
    expect(reading.close).toBe(100);
    expect(reading.date).toBe(points[18]?.date);
  });

  it('sorts dated rows and excludes observations after an explicit as-of date', () => {
    const points = series(25, (index) => 100 + index).reverse();
    const reading = analyzeMovingAverages(points, '2025-01-20');

    expect(reading.date).toBe('2025-01-20');
    expect(reading.close).toBe(119);
    expect(reading.observations).toBe(20);
    expect(reading.sma20).toBe(109.5);
  });

  it('reports the close distance and five-valid-session average slope', () => {
    const reading = analyzeMovingAverages(series(25, (index) => 100 + index));

    expect(reading.distance20Pct).toBeCloseTo((124 / 114.5 - 1) * 100, 10);
    expect(reading.slope20Pct).toBeCloseTo((114.5 / 109.5 - 1) * 100, 10);
  });

  it('classifies full, short/intermediate, and incomplete structures without a score', () => {
    const rising = analyzeMovingAverages(series(220, (index) => 50 + index));
    const falling = analyzeMovingAverages(series(220, (index) => 300 - index));
    const short = analyzeMovingAverages(series(50, (index) => 100 + index));
    const incomplete = analyzeMovingAverages(series(20, () => 100));

    expect(rising.regime).toBe('haussier');
    expect(rising.regimeHorizon).toBe('complet');
    expect(falling.regime).toBe('baissier');
    expect(falling.regimeHorizon).toBe('complet');
    expect(short.regime).toBe('haussier');
    expect(short.regimeHorizon).toBe('court_moyen');
    expect(incomplete.regime).toBe('incomplet');
    expect(incomplete.regimeHorizon).toBe('incomplet');
  });

  it('reports only a crossover observed on the latest consecutive close', () => {
    const bullish = analyzeMovingAverages(series(60, (index) => index === 59 ? 200 : 100));
    const bearish = analyzeMovingAverages(series(60, (index) => index === 59 ? 1 : 100));
    const withMissingLatest = series(60, (index) => index === 59 ? null : index === 58 ? 200 : 100);
    const asOfAfterLastQuote = analyzeMovingAverages(series(60, (index) => index === 59 ? 200 : 100), '2025-03-02');

    expect(bullish.crossover).toBe('haussier');
    expect(bearish.crossover).toBe('baissier');
    expect(analyzeMovingAverages(withMissingLatest).crossover).toBeNull();
    expect(asOfAfterLastQuote.crossover).toBeNull();
  });
});

describe('calculateSectorBreadth', () => {
  it('counts same-session closes above each available average', () => {
    const first = series(200, (index) => 100 + index).map((point, index) => ({ ...point, code: 'A' }));
    const second = series(200, (index) => index === 199 ? 101 : 100).map((point) => ({ ...point, code: 'B' }));
    const third = series(200, () => 100).map((point) => ({ ...point, code: 'C' }));

    expect(calculateSectorBreadth([first, second, third], '2025-07-19')).toEqual({
      sma50Above: { above: 2, total: 3, percent: 66.66666666666666 },
      sma200Above: { above: 2, total: 3, percent: 66.66666666666666 },
    });
  });

  it('excludes stale peers and keeps percentages unavailable below three eligible peers', () => {
    const currentA = series(50, (index) => 100 + index).map((point) => ({ ...point, code: 'A' }));
    const currentB = series(50, () => 100).map((point) => ({ ...point, code: 'B' }));
    const asOfDate = currentA[currentA.length - 1]!.date;
    const stale = series(50, (index) => index === 49 ? null : 100).map((point) => ({ ...point, code: 'C' }));

    expect(calculateSectorBreadth([currentA, currentB, stale], asOfDate)).toEqual({
      sma50Above: { above: 1, total: 2, percent: null },
      sma200Above: { above: 0, total: 0, percent: null },
    });
  });
});
