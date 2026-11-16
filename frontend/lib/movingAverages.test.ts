import { describe, expect, it } from 'vitest';
import {
  analyzeMovingAverages,
  buildMovingAverageChart,
  calculateSectorBreadth,
  describeMovingAveragePosition,
} from './movingAverages';
import type { DatedClose, MovingAverageReading } from './movingAverages';

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

describe('buildMovingAverageChart', () => {
    it('orders reversed data, filters invalid closes and returns the last 120 valid observations', () => {
      const observations = series(220, (index) => index + 100);
      const input = [
        ...observations,
        { code: 'TEST', date: '2025-01-15', close: null },
        { code: 'TEST', date: '2025-01-16', close: -10 },
        { code: 'TEST', date: '2025-01-17', close: Number.POSITIVE_INFINITY },
        { code: 'TEST', date: '2025-01-18', close: Number.NaN },
        { code: 'TEST', date: '2025-02-30', close: 999 },
      ].reverse();

      const result = buildMovingAverageChart(input);

      expect(result).toHaveLength(120);
      expect(result[0]).toMatchObject({
        date: observations[100]!.date,
        close: 200,
        sma20: 190.5,
        sma50: 175.5,
        sma200: null,
      });
      expect(result.at(-1)).toMatchObject({
        date: observations[219]!.date,
        close: 319,
        sma20: 309.5,
        sma50: 294.5,
        sma200: 219.5,
      });
      expect(result.map((point) => point.date)).toEqual(
        [...result.map((point) => point.date)].sort(),
      );
    });

    it('computes SMA200 against the full valid series before taking the final 120 points', () => {
      const result = buildMovingAverageChart(series(220, (index) => index + 100));

      expect(result[98]?.sma200).toBeNull();
      expect(result[99]?.sma200).toBe(199.5);
    });

    it('does not include observations after the requested date', () => {
      const observations = series(220, (index) => index + 100);
      const result = buildMovingAverageChart([...observations].reverse(), observations[210]!.date);

      expect(result.at(-1)?.date).toBe(observations[210]!.date);
      expect(result).toHaveLength(120);
    });

    it('keeps unavailable averages null when the history is too short', () => {
      const result = buildMovingAverageChart(series(19, () => 100));

      expect(result).toHaveLength(19);
      expect(result.every((point) => point.sma20 === null && point.sma50 === null && point.sma200 === null)).toBe(true);
    });
  });

  function reading(
    distances: Partial<Pick<MovingAverageReading, 'distance20Pct' | 'distance50Pct' | 'distance200Pct'>>,
  ): MovingAverageReading {
    return {
      date: null,
      close: null,
      observations: 0,
      sma20: null,
      sma50: null,
      sma200: null,
      distance20Pct: null,
      distance50Pct: null,
      distance200Pct: null,
      slope20Pct: null,
      slope50Pct: null,
      slope200Pct: null,
      regime: 'incomplet',
      regimeHorizon: 'incomplet',
      crossover: null,
      ...distances,
    };
  }

  describe('describeMovingAveragePosition', () => {
    it('describes the course above every available average without turning it into advice', () => {
      const description = describeMovingAveragePosition(
        reading({ distance20Pct: 1, distance50Pct: 2, distance200Pct: 3 }),
      );

      expect(description).toMatch(/au-dessus/i);
      expect(description).toMatch(/20/);
      expect(description).toMatch(/50/);
      expect(description).toMatch(/200/);
      expect(description).not.toMatch(/acheter|vendre|signal/i);
    });

    it('describes the course below every available average', () => {
      const description = describeMovingAveragePosition(
        reading({ distance20Pct: -1, distance50Pct: -2, distance200Pct: -3 }),
      );

      expect(description).toMatch(/sous|en dessous/i);
      expect(description).toMatch(/20/);
      expect(description).toMatch(/50/);
      expect(description).toMatch(/200/);
    });

    it('describes equal positions as being at the averages', () => {
      const description = describeMovingAveragePosition(
        reading({ distance20Pct: 0, distance50Pct: 0, distance200Pct: 0 }),
      );

      expect(description).toMatch(/au niveau|à proximité|confond/i);
      expect(description).toMatch(/20/);
      expect(description).toMatch(/50/);
      expect(description).toMatch(/200/);
    });

    it('reports distinct positions when horizons disagree', () => {
      const description = describeMovingAveragePosition(
        reading({ distance20Pct: 1, distance50Pct: -1, distance200Pct: 0 }),
      );

      expect(description).toMatch(/contrast|différ|selon les horizons/i);
      expect(description).toMatch(/20/);
      expect(description).toMatch(/50/);
      expect(description).toMatch(/200/);
    });

    it('names missing horizons in an incomplete reading', () => {
      const description = describeMovingAveragePosition(
        reading({ distance20Pct: 1, distance50Pct: null, distance200Pct: null }),
      );

      expect(description).toMatch(/incomplète/i);
      expect(description).toMatch(/50/);
      expect(description).toMatch(/200/);
    });
  });
