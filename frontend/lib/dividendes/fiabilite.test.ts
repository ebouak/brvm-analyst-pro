import { describe, it, expect } from 'vitest';
import { fiabiliteDividende } from './fiabilite';

describe('fiabiliteDividende', () => {
  it('SNTS : croissance régulière, distribution sous 100 %', () => {
    const f = fiabiliteDividende(
      [140, 150, 158, 166, 174].map((m, i) => ({ exercice: 2021 + i, montant: m })),
      [{ year: 2025, net_income: 413.59e9 }],
      1e9,
    )!;
    expect(f.dernierExercice).toBe(2025);
    expect(f.croissanceAnnuelle!).toBeCloseTo(Math.pow(174 / 140, 1 / 4) - 1, 6);
    expect(f.distribution!).toBeCloseTo(0.4207, 3);
    expect(f.distributionAuDela).toBe(false);
    expect(f.sansVersement).toEqual([]);
  });
  it('SDSC : distribution au-delà du résultat signalée', () => {
    const f = fiabiliteDividende([{ exercice: 2025, montant: 92 }], [{ year: 2025, net_income: 0.785e9 }], 54.44e6)!;
    expect(f.distribution!).toBeGreaterThan(6);
    expect(f.distributionAuDela).toBe(true);
    expect(f.croissanceAnnuelle).toBeNull();
  });
  it('exercices sans versement, comptés depuis le premier exercice connu seulement', () => {
    const f = fiabiliteDividende(
      [{ exercice: 2022, montant: 83 }, { exercice: 2023, montant: 206 }, { exercice: 2024, montant: 0 }, { exercice: 2025, montant: 201.52 }, { exercice: null, montant: 121 }],
      [],
      null,
    )!;
    expect(f.sansVersement).toEqual([2024]);
    expect(f.exercicesFenetre).toBe(4);
    expect(f.distribution).toBeNull();
  });
  it('aucun versement : rien à dire', () => {
    expect(fiabiliteDividende([{ exercice: 2025, montant: 0 }], [], 1)).toBeNull();
  });
});
