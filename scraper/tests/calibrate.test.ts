import { describe, it, expect } from 'vitest';
import {
  measureSession,
  momentumGrid,
  volumeGrid,
  confluences,
  formatReport,
  type SessionMeasure,
} from '../src/intraday/calibrate.js';

const M = (code: string, date: string, momentumPct: number, volumeRatio: number | null): SessionMeasure => ({
  code, date, momentumPct, volumeRatio,
});

const MEASURES: SessionMeasure[] = [
  M('AAA', '2026-07-10', +7.5, 2.7),  // confluence
  M('BBB', '2026-07-10', -4.1, 0.8),  // momentum seul (baisse)
  M('CCC', '2026-07-10', +0.0, 4.0),  // volume seul
  M('DDD', '2026-07-10', +1.2, null), // volume inconnu → exclu du grid volume
  M('AAA', '2026-07-11', +0.5, 1.0),  // rien
];

describe('measureSession', () => {
  it('mesure momentum signé et ratio de volume (volume cumulé)', () => {
    const m = measureSession('SNTS', '2026-07-10',
      [{ close: 100, volume: 50 }, { close: 97, volume: 200 }], 100);
    expect(m).not.toBeNull();
    expect(m!.momentumPct).toBeCloseTo(-3.0, 5); // signé : une baisse reste négative
    expect(m!.volumeRatio).toBeCloseTo(2.0, 5);  // 200 (cumul final) / 100
  });

  it('moyenne de volume inconnue → ratio null, jamais inventé', () => {
    const m = measureSession('X', 'd', [{ close: 100, volume: 1 }, { close: 101, volume: 2 }], null);
    expect(m!.volumeRatio).toBeNull();
  });

  it('moins de 2 relevés → null (pas de mesure)', () => {
    expect(measureSession('X', 'd', [{ close: 100, volume: 1 }], 100)).toBeNull();
  });
});

describe('grilles de seuils', () => {
  it('momentum : compte |mouvement| ≥ seuil (les baisses comptent)', () => {
    const rows = momentumGrid(MEASURES, [1, 3, 5]);
    expect(rows[0]).toMatchObject({ threshold: 1, hits: 3, total: 5 }); // 7.5, 4.1, 1.2
    expect(rows[1]).toMatchObject({ threshold: 3, hits: 2 });           // 7.5, 4.1
    expect(rows[2]).toMatchObject({ threshold: 5, hits: 1 });           // 7.5
  });

  it('volume : population = mesures avec ratio connu uniquement', () => {
    const rows = volumeGrid(MEASURES, [2]);
    expect(rows[0]).toMatchObject({ threshold: 2, hits: 2, total: 4 }); // 2.7 et 4.0, sur 4 connus
  });
});

describe('confluences', () => {
  it('exige mouvement ET volume anormal', () => {
    const c = confluences(MEASURES, 3, 2);
    expect(c.map((m) => m.code)).toEqual(['AAA']);
  });
});

describe('formatReport', () => {
  it('rapport lisible avec seuils actuels marqués', () => {
    const r = formatReport(MEASURES, {
      momentumThresholds: [1, 3], volumeThresholds: [2], currentMomentum: 3, currentVolume: 2,
    });
    expect(r).toContain('2 séance(s)');
    expect(r).toContain('← seuil actuel');
    expect(r).toContain('Confluences aux seuils actuels (3 % et 2×) : 1');
    expect(r).toContain('AAA');
  });
});
