/**
 * Intraday snapshot reconstruction into 15-minute candles
 * Transforms a stream of point-in-time price snapshots into standardized OHLCV candles
 */

export interface Snapshot {
  code: string;
  timestamp: Date;
  close: number;
  volume: number;
}

export interface Candle15m {
  code: string;
  date_marche: string;
  time_start: Date;
  time_end: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sample_count: number;
  quality_score: number;
  is_complete: boolean;
  is_synthetic: boolean;
  source: string;
  engine_version: string;
}

/**
 * Reconstruct 15-minute candles from intraday snapshots
 *
 * Groups snapshots into 15-minute windows, calculates OHLCV and quality metrics.
 * Expected pattern: 4 snapshots per 15m window (every ~5 minutes during trading hours).
 *
 * @param snapshots - Array of intraday price snapshots
 * @param code - Instrument code (e.g., 'PALC')
 * @param dateMarche - Trading date
 * @returns Array of reconstructed 15-minute candles
 */
export function reconstruct15mCandles(
  snapshots: Snapshot[],
  code: string,
  dateMarche: Date,
): Candle15m[] {
  if (snapshots.length === 0) return [];

  // Group snapshots by 15-minute windows
  const windowMap = new Map<number, Snapshot[]>();

  for (const snap of snapshots) {
    const minutes = snap.timestamp.getUTCHours() * 60 + snap.timestamp.getUTCMinutes();
    let windowStart = Math.floor(minutes / 15) * 15;

    // Special handling: snapshots exactly on a 15-minute boundary (but not at hour start)
    // belong to the CURRENT window (inclusive right boundary), not the next window
    if (minutes % 15 === 0 && minutes % 60 !== 0) {
      windowStart = windowStart - 15;
    }

    if (!windowMap.has(windowStart)) {
      windowMap.set(windowStart, []);
    }
    windowMap.get(windowStart)!.push(snap);
  }

  // Build candles from each 15-minute window
  const candles: Candle15m[] = [];

  for (const [windowStart, windowSnapshots] of windowMap) {
    // Skip empty windows (shouldn't happen, but be safe)
    if (windowSnapshots.length === 0) continue;

    // Sort snapshots chronologically within the window
    const sortedSnaps = windowSnapshots.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    const firstSnap = sortedSnaps[0]!;
    const lastSnap = sortedSnaps[sortedSnaps.length - 1]!;

    const open = firstSnap.close;
    const close = lastSnap.close;
    const high = Math.max(...sortedSnaps.map((s) => s.close));
    const low = Math.min(...sortedSnaps.map((s) => s.close));
    const volume = sortedSnaps.reduce((sum, s) => sum + s.volume, 0);

    // Quality score: expected 4 snapshots per 15m (every 5 min in BRVM trading hours)
    const expectedSamplesIn15m = 4;
    const qualityScore = Math.min(1.0, sortedSnaps.length / expectedSamplesIn15m);

    // Construct candle time boundaries
    const timeStart = new Date(dateMarche);
    timeStart.setUTCHours(Math.floor(windowStart / 60), windowStart % 60, 0, 0);

    const timeEnd = new Date(timeStart);
    timeEnd.setUTCMinutes(timeEnd.getUTCMinutes() + 15);

    const dateMarkeStr = dateMarche.toISOString().split('T')[0];
    if (!dateMarkeStr) continue; // Safety check

    candles.push({
      code,
      date_marche: dateMarkeStr,
      time_start: timeStart,
      time_end: timeEnd,
      open,
      high,
      low,
      close,
      volume,
      sample_count: sortedSnaps.length,
      quality_score: qualityScore,
      is_complete: sortedSnaps.length >= expectedSamplesIn15m,
      is_synthetic: true,
      source: 'brvm_public_snapshot',
      engine_version: 'v1.0.0',
    });
  }

  return candles;
}
