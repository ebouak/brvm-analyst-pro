import { describe, it, expect } from 'vitest';
import { sma, ema, rsi, clamp } from '../src/scoring/indicators.js';
import { computeScore } from '../src/scoring/score.js';

describe('indicateurs', () => {
  it('sma: moyenne des N derniers', () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([1, 2, 3, 4, 5], 2)).toBe(4.5);
    expect(sma([1, 2], 5)).toBeNull();
  });

  it('ema: défini et borné par les extrêmes', () => {
    const v = ema([1, 2, 3, 4, 5, 6, 7, 8], 3);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(1);
    expect(v!).toBeLessThanOrEqual(8);
  });

  it('rsi: série strictement croissante => 100', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(closes, 14)).toBe(100);
  });

  it('rsi: série strictement décroissante => 0', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi(closes, 14)).toBe(0);
  });

  it('rsi: null si historique insuffisant', () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });

  it('clamp borne correctement', () => {
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(-5, -1, 1)).toBe(-1);
    expect(clamp(0.3, -1, 1)).toBe(0.3);
  });
});

describe('computeScore', () => {
  it('neutralise (HOLD) si historique trop court', () => {
    const r = computeScore({
      code: 'X',
      closes: [100, 101, 102],
      variation_pct: 2,
      volume: 1000,
      avg_volume_30d: 800,
    });
    expect(r.signal).toBe('HOLD');
    expect(r.inputs.incomplet).toBe(true);
    expect(r.confiance).toBeLessThanOrEqual(0.3);
  });

  it('survente + forte hausse + gros volume => BUY', () => {
    // Série en forte baisse (RSI bas) puis rebond le dernier jour.
    const closes = Array.from({ length: 30 }, (_, i) => 200 - i * 3);
    closes[closes.length - 1] = closes[closes.length - 2]! + 8; // rebond
    const r = computeScore({
      code: 'BUY1',
      closes,
      variation_pct: 7, // forte hausse plafonnée
      volume: 5000,
      avg_volume_30d: 1000, // ratio 5x
    });
    expect(r.score_rsi).not.toBeNull();
    expect(r.score_total).toBeGreaterThan(0.6);
    expect(r.signal).toBe('BUY');
    expect(r.explication).toContain('Opportunité');
  });

  it('surachat + forte baisse + gros volume => SELL', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 3);
    closes[closes.length - 1] = closes[closes.length - 2]! - 8;
    const r = computeScore({
      code: 'SELL1',
      closes,
      variation_pct: -7,
      volume: 5000,
      avg_volume_30d: 1000,
    });
    expect(r.score_total).toBeLessThan(-0.6);
    expect(r.signal).toBe('SELL');
  });

  it('marché calme => HOLD', () => {
    const closes = Array.from({ length: 60 }, () => 100);
    const r = computeScore({
      code: 'FLAT',
      closes,
      variation_pct: 0,
      volume: 1000,
      avg_volume_30d: 1000,
    });
    expect(r.signal).toBe('HOLD');
    expect(Math.abs(r.score_total)).toBeLessThanOrEqual(0.6);
  });

  it('sous-scores et score total bornés dans [-1,1]', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 5);
    const r = computeScore({
      code: 'B',
      closes,
      variation_pct: 50, // outlier -> doit être plafonné
      volume: 1e9,
      avg_volume_30d: 100,
    });
    expect(r.score_total).toBeGreaterThanOrEqual(-1);
    expect(r.score_total).toBeLessThanOrEqual(1);
    expect(r.score_variation!).toBeLessThanOrEqual(1);
  });

  it('pénalité de liquidité appliquée sur faible volume moyen', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.1);
    const r = computeScore({
      code: 'ILLIQ',
      closes,
      variation_pct: 1,
      volume: 5,
      avg_volume_30d: 10, // < seuil 100
    });
    expect(r.penalite_liquidite).toBeGreaterThan(0);
  });
});
