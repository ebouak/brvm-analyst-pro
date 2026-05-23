// Tests des fonctions pures de frontend/lib/reportUtils.ts
// Import cross-package via chemin relatif (même pattern que backtest.test.ts).
import { describe, it, expect } from 'vitest';
import {
  computeVariation,
  topMovers,
  normalizeBase100,
  filterEventsByPeriod,
  volatility20d,
} from '../../frontend/lib/reportUtils.js';

describe('computeVariation', () => {
  it('calcule la variation en %', () => {
    expect(computeVariation(100, 110)).toBeCloseTo(10);
    expect(computeVariation(200, 150)).toBeCloseTo(-25);
  });
  it('renvoie 0 si from = 0', () => {
    expect(computeVariation(0, 100)).toBe(0);
  });
});

describe('topMovers', () => {
  const rows = [
    { code: 'A', variation_pct: 5 },
    { code: 'B', variation_pct: -3 },
    { code: 'C', variation_pct: 12 },
    { code: 'D', variation_pct: null },
    { code: 'E', variation_pct: -8 },
  ];

  it('top 3 hausses', () => {
    const top = topMovers(rows, 3, 'up');
    expect(top.map((r) => r.code)).toEqual(['C', 'A', 'B']);
  });

  it('top 3 baisses', () => {
    const bot = topMovers(rows, 3, 'down');
    expect(bot.map((r) => r.code)).toEqual(['E', 'B', 'A']);
  });

  it('exclut les variation_pct null', () => {
    const top = topMovers(rows, 10, 'up');
    expect(top.every((r) => r.variation_pct != null)).toBe(true);
  });
});

describe('normalizeBase100', () => {
  it('premier cours = 100', () => {
    const result = normalizeBase100([200, 220, 180]);
    expect(result[0]).toBeCloseTo(100);
    expect(result[1]).toBeCloseTo(110);
    expect(result[2]).toBeCloseTo(90);
  });

  it('conserve les null', () => {
    const result = normalizeBase100([null, 100, 110]);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeCloseTo(100);
  });

  it('renvoie tableau de null si aucun cours > 0', () => {
    const result = normalizeBase100([null, null]);
    expect(result.every((v) => v === null)).toBe(true);
  });
});

describe('filterEventsByPeriod', () => {
  const events = [
    { event_date: '2025-01-05', title: 'A' },
    { event_date: '2025-03-15', title: 'B' },
    { event_date: '2025-06-01', title: 'C' },
  ];

  it('filtre par période inclusive', () => {
    const r = filterEventsByPeriod(events, '2025-01-05', '2025-03-15');
    expect(r.map((e) => e.title)).toEqual(['A', 'B']);
  });

  it('exclut les événements hors bornes', () => {
    const r = filterEventsByPeriod(events, '2025-04-01', '2025-05-31');
    expect(r).toHaveLength(0);
  });
});

describe('volatility20d', () => {
  it('renvoie null si moins de 2 cours', () => {
    expect(volatility20d([100])).toBeNull();
    expect(volatility20d([])).toBeNull();
  });

  it('renvoie 0 sur série plate', () => {
    const flat = Array.from({ length: 25 }, () => 100);
    expect(volatility20d(flat)).toBeCloseTo(0);
  });

  it('volatilité > 0 sur série variable', () => {
    const varied = [100, 105, 98, 110, 95, 102, 108, 97, 103, 106,
                    99, 112, 93, 107, 101, 96, 109, 104, 98, 111, 100];
    const vol = volatility20d(varied);
    expect(vol).not.toBeNull();
    expect(vol!).toBeGreaterThan(0);
  });
});
