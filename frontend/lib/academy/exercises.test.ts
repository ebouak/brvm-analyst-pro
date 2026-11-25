import { describe, expect, it } from 'vitest';
import {
  withinTolerance,
  buildPerExercise,
  buildRendementExercise,
  buildTrapChoice,
  buildCapitalisationExercise,
  buildCoutOrdreExercise,
  buildVariationExercise,
  buildPositionMoyenneExercise,
  buildRsiZoneChoice,
  buildEcartIpoExercise,
} from './exercises';

const compact = (s: string) => s.replace(/[\s\u00a0\u202f]/g, '');

describe('Academy live exercises (Lots #1 + #2)', () => {
  it('withinTolerance : ±2 % relatif', () => {
    expect(withinTolerance(10.2, 10.0, 2)).toBe(true);
    expect(withinTolerance(9.8, 10.0, 2)).toBe(true);
    expect(withinTolerance(10.3, 10.0, 2)).toBe(false);
    expect(withinTolerance(0, 0, 2)).toBe(true);
    expect(withinTolerance(1, 0, 2)).toBe(false);
  });

  it('buildPerExercise : énoncé avec les données du jour, attendu = cours/BPA', () => {
    const ex = buildPerExercise({ code: 'SNTS', cours: 31800, bpa: 4136, date: '2026-07-17' });
    expect(ex.pub.id).toBe('per-du-jour');
    expect(ex.pub.type).toBe('numeric');
    expect(ex.pub.enonce).toContain('SNTS');
    expect(compact(ex.pub.enonce)).toContain('31800');
    expect(compact(ex.pub.enonce)).toContain('4136');
    expect(Math.abs(ex.expected - 31800 / 4136)).toBeLessThan(0.001);
  });

  it('buildRendementExercise : attendu = dividende/cours en %', () => {
    const ex = buildRendementExercise({
      code: 'SNTS',
      cours: 32000,
      dividende: 1740,
      exercice: 2025,
      date: '2026-07-17',
    });
    expect(ex.pub.id).toBe('rendement-net');
    expect(ex.pub.unite).toBe('%');
    expect(Math.abs(ex.expected - (1740 / 32000) * 100)).toBeLessThan(0.001);
  });

  it('buildTrapChoice : identifie le value trap réel et renvoie null sinon', () => {
    const ex = buildTrapChoice([
      { code: 'SNTS', nom: 'SONATEL', per: 7.7, nets: [331_748e6, 393_662e6, 413_588e6] },
      { code: 'PALC', nom: 'PALMCI', per: 8.6, nets: [41_693e6, 19_352e6, 15_862e6, 15_509e6] },
      { code: 'SGBC', nom: 'SGCI', per: 11.7, nets: [30_000e6, 31_000e6, 32_000e6] },
    ]);
    expect(ex?.expected).toBe(1);

    const safe = buildTrapChoice([
      { code: 'A', nom: 'A', per: 9, nets: [10e9, 11e9, 12e9] },
      { code: 'B', nom: 'B', per: 12, nets: [5e9, 5.2e9, 5.4e9] },
    ]);
    expect(safe).toBeNull();
  });

  it('buildCapitalisationExercise : attendu = cours * shares / 1e9', () => {
    const ex = buildCapitalisationExercise({
      code: 'SNTS',
      nom: 'SONATEL',
      cours: 30000,
      shares: 100_000_000,
      date: '2026-11-24',
    });
    expect(ex.pub.id).toBe('capitalisation-du-jour');
    expect(ex.pub.unite).toBe('Md FCFA');
    expect(ex.expected).toBe(3000);
  });

  it('buildCoutOrdreExercise : applique max(proportionnel, minimum)', () => {
    const prop = buildCoutOrdreExercise({
      code: 'SNTS',
      cours: 30000,
      quantite: 10,
      tauxPct: 1.5,
      minimumFcfa: 2500,
      date: '2026-11-24',
    });
    expect(prop.expected).toBe(304500);

    const min = buildCoutOrdreExercise({
      code: 'ETIT',
      cours: 20,
      quantite: 100,
      tauxPct: 1.5,
      minimumFcfa: 2500,
      date: '2026-11-24',
    });
    expect(min.expected).toBe(4500);
  });

  it('buildVariationExercise : variation signée en % sur 20 séances', () => {
    const ex = buildVariationExercise({
      code: 'SGBC',
      nom: 'SGCI',
      coursInitial: 20000,
      dateInitiale: '2026-10-20',
      coursFinal: 22000,
      dateFinale: '2026-11-24',
    });
    expect(ex.pub.id).toBe('variation-20-seances');
    expect(Math.abs(ex.expected - 10)).toBeLessThan(0.001);
  });

  it('buildPositionMoyenneExercise : écart relatif cours vs MM20', () => {
    const ex = buildPositionMoyenneExercise({
      code: 'SNTS',
      nom: 'SONATEL',
      cours: 29400,
      mm20: 30000,
      date: '2026-11-24',
    });
    expect(ex.pub.id).toBe('position-moyenne-20');
    expect(Math.abs(ex.expected - -2)).toBeLessThan(0.001);
  });

  it('buildRsiZoneChoice : classe survente / neutre / surachat selon 30 et 70', () => {
    expect(buildRsiZoneChoice({ code: 'A', nom: 'A', rsi: 24.5, date: '2026-11-24' }).expected).toBe(0);
    expect(buildRsiZoneChoice({ code: 'A', nom: 'A', rsi: 52.1, date: '2026-11-24' }).expected).toBe(1);
    expect(buildRsiZoneChoice({ code: 'A', nom: 'A', rsi: 76.8, date: '2026-11-24' }).expected).toBe(2);
  });

  it('buildEcartIpoExercise : écart BBGC vs prix IPO 6 750 FCFA', () => {
    const ex = buildEcartIpoExercise({ cours: 8100, date: '2026-11-24' });
    expect(ex.pub.id).toBe('ecart-ipo-bbgc');
    expect(Math.abs(ex.expected - 20)).toBeLessThan(0.001);
  });
});
