import { describe, it, expect } from 'vitest';
import { backtestSignalsForCode, summarizeBacktest, type DailyPoint } from '../src/scoring/backtestSignals.js';

function mkPoints(closes: number[], startDate = '2024-01-01'): DailyPoint[] {
  const start = new Date(startDate + 'T00:00:00Z');
  return closes.map((close, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    return { date: d.toISOString().slice(0, 10), close, volume: 1000 };
  });
}

describe('backtestSignalsForCode', () => {
  it('renvoie [] si historique trop court (< warmup)', () => {
    const points = mkPoints(Array.from({ length: 10 }, (_, i) => 100 + i));
    expect(backtestSignalsForCode('TEST', points)).toEqual([]);
  });

  it('déduplique les séquences BUY consécutives (une seule entrée par séquence)', () => {
    // Série oscillante forçant un RSI bas régulier (survente répétée) sur une
    // fenêtre continue → plusieurs jours de BUY consécutifs doivent compter 1 fois.
    const base = Array.from({ length: 60 }, (_, i) => 1000 - i * 5); // tendance baissière franche (RSI bas)
    const points = mkPoints(base);
    const signals = backtestSignalsForCode('TEST', points);
    // Vérifie qu'il n'y a jamais deux dates consécutives (écart <= 5j) dans le résultat déduplique.
    for (let i = 1; i < signals.length; i++) {
      const d0 = new Date(signals[i - 1]!.dateSignal + 'T00:00:00Z');
      const d1 = new Date(signals[i]!.dateSignal + 'T00:00:00Z');
      const gapDays = (d1.getTime() - d0.getTime()) / 86_400_000;
      expect(gapDays).toBeGreaterThan(5);
    }
  });

  it('calcule perfPct = null si pas assez de recul pour atteindre l’horizon', () => {
    const base = Array.from({ length: 55 }, (_, i) => 1000 - i * 5);
    const points = mkPoints(base);
    const signals = backtestSignalsForCode('TEST', points);
    // Le dernier signal (proche de la fin de série) ne peut pas avoir de recul suffisant.
    const withoutHorizon = signals.filter((s) => s.perfPct == null);
    for (const s of withoutHorizon) {
      expect(s.coursHorizon).toBeNull();
    }
  });

  it('calcule correctement perfPct quand l’horizon est disponible', () => {
    // 50 jours plats (warmup) puis chute nette (déclenche BUY) puis hausse connue à horizon+21.
    const flat = Array.from({ length: 50 }, () => 1000);
    const drop = [900]; // chute → RSI bas → signal BUY probable
    const afterDrop = Array.from({ length: 25 }, () => 900); // plateau, index+21 = 1000e valeur connue
    const series = [...flat, ...drop, ...afterDrop];
    const points = mkPoints(series);
    const signals = backtestSignalsForCode('TEST', points);
    for (const s of signals) {
      if (s.coursHorizon != null) {
        expect(s.perfPct).toBeCloseTo(((s.coursHorizon - s.coursSignal) / s.coursSignal) * 100, 6);
      }
    }
  });
});

describe('summarizeBacktest', () => {
  it('N=0 → tout null', () => {
    expect(summarizeBacktest([])).toEqual({ nTotal: 0, nWithHorizon: 0, avgPerfPct: null, pctPositive: null });
  });

  it('agrège moyenne et % positifs en ignorant les perf null', () => {
    const signals = [
      { code: 'A', dateSignal: '2024-01-01', coursSignal: 100, coursHorizon: 110, perfPct: 10, horizonSeances: 21 },
      { code: 'B', dateSignal: '2024-01-02', coursSignal: 100, coursHorizon: 90, perfPct: -10, horizonSeances: 21 },
      { code: 'C', dateSignal: '2024-01-03', coursSignal: 100, coursHorizon: null, perfPct: null, horizonSeances: 21 },
    ];
    const summary = summarizeBacktest(signals);
    expect(summary.nTotal).toBe(3);
    expect(summary.nWithHorizon).toBe(2);
    expect(summary.avgPerfPct).toBeCloseTo(0, 6);
    expect(summary.pctPositive).toBeCloseTo(50, 6);
  });
});
