import { describe, it, expect } from 'vitest';
import { reconstruct15mCandles, Snapshot } from '../../src/intraday/reconstruct.js';

describe('reconstruct15mCandles', () => {
  it('should reconstruct 15m candles from snapshots', () => {
    const snapshots: Snapshot[] = [
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T10:00:00Z'),
        close: 100,
        volume: 1000,
      },
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T10:05:00Z'),
        close: 102,
        volume: 500,
      },
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T10:10:00Z'),
        close: 101,
        volume: 750,
      },
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T10:15:00Z'),
        close: 103,
        volume: 600,
      },
    ];

    const candles = reconstruct15mCandles(snapshots, 'PALC', new Date('2026-07-07'));

    expect(candles).toHaveLength(1);
    expect(candles[0]).toMatchObject({
      code: 'PALC',
      open: 100,           // First snapshot close
      high: 103,           // Max close across snapshots
      low: 100,            // Min close across snapshots
      close: 103,          // Last snapshot close
      volume: 2850,        // Sum of volumes
      quality_score: 1.0,  // 4 snapshots in 15m window = 100%
    });
  });

  it('should handle missing snapshots with quality degradation', () => {
    const snapshots: Snapshot[] = [
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T10:00:00Z'),
        close: 100,
        volume: 1000,
      },
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T10:10:00Z'),
        close: 102,
        volume: 800,
      },
      // Missing 10:05 and 10:15
    ];

    const candles = reconstruct15mCandles(snapshots, 'PALC', new Date('2026-07-07'));

    expect(candles[0]).toMatchObject({
      quality_score: 0.5,  // 2 out of 4 expected = 50%
      is_complete: false,  // Incomplete due to missing snapshots
    });
  });

  it('should return empty array if no snapshots', () => {
    const candles = reconstruct15mCandles([], 'PALC', new Date('2026-07-07'));
    expect(candles).toHaveLength(0);
  });
});
