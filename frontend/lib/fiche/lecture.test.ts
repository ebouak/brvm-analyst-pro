import { describe, it, expect } from 'vitest';
import { lectureTechnique } from './lecture';

describe('lectureTechnique (STAC 6 nov. 2026)', () => {
  const l = lectureTechnique({ cours: 1950, variationPct: 5.41, ma20: 1911, ma50: 2187.7, ma200: 2531.8, macd: -85.4, macdSignal: -111.27, rsi: 48.1, volume: 1551, volumeMoyen: 4782 });
  it('classe les facteurs sans contradiction', () => {
    expect(l.soutient).toEqual(['Forte hausse du jour, +5,41 %', 'Cours au-dessus de sa moyenne 20 séances', 'MACD au-dessus de son signal']);
    expect(l.retient).toEqual(['Moyennes 20, 50, 200 en ordre baissier', 'MACD sous zéro', 'Volume sous la moyenne (0,3×)']);
    expect(l.neutres).toEqual(['RSI 48 en zone neutre']);
  });
  it('vide sans données', () => {
    expect(lectureTechnique({ cours: null, variationPct: null, ma20: null, ma50: null, ma200: null, macd: null, macdSignal: null, rsi: null, volume: null, volumeMoyen: null }))
      .toEqual({ soutient: [], retient: [], neutres: [] });
  });
});
