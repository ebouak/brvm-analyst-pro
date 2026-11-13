import { describe, it, expect } from 'vitest';
import { pointCarte, quadrant, pointsCarte } from './carte';

describe('pointCarte', () => {
  it('SLBC : forte hausse et RSI 80 → élan haussier, RSI haut', () => {
    const p = pointCarte({ code: 'SLBC', score_variation: 1, score_macd: 0.6, score_rsi: -1, signal: 'HOLD' })!;
    expect(p.tendance).toBeCloseTo(0.8);
    expect(quadrant(p)).toBe('hausse_surachete');
  });
  it('MACD absent : l’élan se lit sur la seule variation', () => {
    expect(pointCarte({ code: 'A', score_variation: -0.4, score_macd: null, score_rsi: 0.5 })!.tendance).toBeCloseTo(-0.4);
  });
  it('sans RSI ou sans élan : pas de point', () => {
    expect(pointCarte({ code: 'A', score_variation: 0.2, score_rsi: null })).toBeNull();
    expect(pointCarte({ code: 'A', score_rsi: 0.2 })).toBeNull();
  });
  it('compte les valeurs écartées', () => {
    expect(pointsCarte([{ code: 'A', score_variation: 0, score_rsi: 0 }, { code: 'B' }]).ecartees).toBe(1);
  });
});
