import { describe, it, expect } from 'vitest';
import { sma, ema, rsi, macd, emaSeries, clamp } from '../src/scoring/indicators.js';
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

  it('emaSeries: une valeur par point à partir de period-1', () => {
    const s = emaSeries([1, 2, 3, 4, 5], 3);
    expect(s.length).toBe(3); // indices 2,3,4
    expect(s[0]).toBeCloseTo(2, 5); // SMA(1,2,3)=2 en seed
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

  it('macd: null si historique insuffisant, sinon histogramme cohérent', () => {
    expect(macd([1, 2, 3])).toBeNull();
    // Tendance haussière franche → ligne MACD > 0.
    const up = Array.from({ length: 60 }, (_, i) => 100 + i * 2);
    const mUp = macd(up);
    expect(mUp).not.toBeNull();
    expect(mUp!.line).toBeGreaterThan(0);
    // Tendance baissière → ligne MACD < 0.
    const down = Array.from({ length: 60 }, (_, i) => 200 - i * 2);
    expect(macd(down)!.line).toBeLessThan(0);
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

  it('tendance haussière qui accélère + hausse + volume => BUY', () => {
    // Hausse régulière puis accélération finale (MACD histogramme positif),
    // ma20 > ma50 (régime haussier), jour de forte hausse confirmé au volume.
    const closes: number[] = [];
    for (let i = 0; i < 40; i++) closes.push(100 + i);
    for (let i = 0; i < 20; i++) closes.push(140 + i * 4); // accélération
    const r = computeScore({
      code: 'BUY1',
      closes,
      variation_pct: 7, // plafonnée
      volume: 6000,
      avg_volume_30d: 1000, // ratio 6x
    });
    expect(r.score_macd).not.toBeNull();
    expect(r.inputs.trend_norm).toBeGreaterThan(0); // régime haussier
    expect(r.bonus_tendance).toBeGreaterThan(0); // facteur tendance positif
    expect(r.score_total).toBeGreaterThan(0.6);
    expect(r.signal).toBe('BUY');
    expect(r.explication).toContain('Opportunité');
  });

  it('tendance baissière qui accélère + baisse + volume => SELL', () => {
    const closes: number[] = [];
    for (let i = 0; i < 40; i++) closes.push(300 - i);
    for (let i = 0; i < 20; i++) closes.push(260 - i * 4); // accélération baissière
    const r = computeScore({
      code: 'SELL1',
      closes,
      variation_pct: -7,
      volume: 6000,
      avg_volume_30d: 1000,
    });
    expect(r.inputs.trend_norm).toBeLessThan(0); // régime baissier
    expect(r.bonus_tendance).toBeLessThan(0); // facteur tendance SYMÉTRIQUE (négatif)
    expect(r.score_total).toBeLessThan(-0.6);
    expect(r.signal).toBe('SELL');
  });

  it('facteur de tendance symétrique : baissier => bonus_tendance négatif', () => {
    const down = Array.from({ length: 60 }, (_, i) => 300 - i * 2);
    const r = computeScore({ code: 'D', closes: down, variation_pct: -1, volume: 1000, avg_volume_30d: 1000 });
    expect(r.bonus_tendance).toBeLessThan(0);
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
    expect(r.score_macd == null || (r.score_macd >= -1 && r.score_macd <= 1)).toBe(true);
  });

  it('confiance : un HOLD central est plus franc qu\'un HOLD près du seuil', () => {
    const flat = Array.from({ length: 60 }, () => 100);
    const central = computeScore({ code: 'C', closes: flat, variation_pct: 0, volume: 1000, avg_volume_30d: 1000 });
    // Score proche de 0 => HOLD franc => netteté élevée.
    expect(central.signal).toBe('HOLD');
    expect(Math.abs(central.score_total)).toBeLessThan(0.2);
    expect(central.confiance).toBeGreaterThan(0.4);
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
