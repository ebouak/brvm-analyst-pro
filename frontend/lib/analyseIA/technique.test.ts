import { describe, it, expect } from 'vitest';
import { lireTechnique } from './technique';
import type { PointCours } from './types';

const serie = (n: number, f: (i: number) => number): PointCours[] =>
  Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
    cours: f(i),
    volume: 10,
    variation_pct: null,
  }));

describe('lecture technique', () => {
  it('moins de 15 séances ⇒ null', () => {
    expect(lireTechnique(serie(10, (i) => 100 + i))).toBeNull();
  });
  it('hausse régulière ⇒ RSI en zone haute, MACD au-dessus de son signal après 35 séances', () => {
    const l = lireTechnique(serie(60, (i) => 100 + i * 2))!;
    expect(l.zone_rsi).toBe('haute');
    expect(l.position_macd).toBe('au-dessus');
    expect(l.mm20).not.toBeNull();
    expect(l.mm50).not.toBeNull();
    expect(l.seance).toBe(serie(60, () => 1)[59]!.date);
  });
  it('baisse régulière ⇒ zone basse', () => {
    expect(lireTechnique(serie(30, (i) => 500 - i * 5))!.zone_rsi).toBe('basse');
  });
  it('20 séances : RSI calculé, MM50 absente', () => {
    const l = lireTechnique(serie(20, (i) => 100 + (i % 3)))!;
    expect(l.rsi14).not.toBeNull();
    expect(l.mm50).toBeNull();
  });
});
