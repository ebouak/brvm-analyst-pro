import { describe, expect, it } from 'vitest';
import { bandePer, perGlissant, type PointCloture } from './per';

const cloture = (annee: number, close: number): PointCloture => ({ date: `${annee}-12-30`, close });

describe('perGlissant', () => {
  it('cours ÷ (résultat glissant ÷ titres)', () => {
    expect(perGlissant({ cours: 4000, titres: 1_000_000_000, resultatGlissant: 400_000_000_000 })).toBeCloseTo(10, 9);
  });
  it('null si un terme manque, ou si le résultat est nul ou négatif (pas de PER sur une perte)', () => {
    expect(perGlissant({ cours: null, titres: 1, resultatGlissant: 1 })).toBeNull();
    expect(perGlissant({ cours: 10, titres: null, resultatGlissant: 1 })).toBeNull();
    expect(perGlissant({ cours: 10, titres: 1, resultatGlissant: null })).toBeNull();
    expect(perGlissant({ cours: 10, titres: 1, resultatGlissant: 0 })).toBeNull();
    expect(perGlissant({ cours: 10, titres: 1, resultatGlissant: -5 })).toBeNull();
  });
});

describe('bandePer', () => {
  const titres = 1000;
  const exercices = [
    { periode: '2025', resultat_net: 400_000 }, // BPA 400
    { periode: '2024', resultat_net: 300_000 }, // 300
    { periode: '2023', resultat_net: 250_000 }, // 250
    { periode: '2022', resultat_net: 200_000 }, // 200
    { periode: '2021', resultat_net: 100_000 }, // 100
  ];
  // PER = cours / BPA : 2021 → 10, 2022 → 12, 2023 → 12, 2024 → 10, 2025 → 8
  const serie = [cloture(2021, 1000), cloture(2022, 2400), cloture(2023, 3000), cloture(2024, 3000), cloture(2025, 3200)];

  it('calcule le PER de fin d’exercice, la fourchette et la médiane', () => {
    const b = bandePer({ exercices, titres, serie, perActuel: 9 })!;
    expect(b.points.map((p) => p.exercice)).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(b.points.map((p) => Math.round(p.per * 100) / 100)).toEqual([10, 12, 12, 10, 8]);
    expect(b.min).toBeCloseTo(8, 9);
    expect(b.max).toBeCloseTo(12, 9);
    expect(b.mediane).toBeCloseTo(10, 9);
    expect(b.situation).toBe('dans');
    expect(b.position).toBeCloseTo(0.25, 9);
  });

  it('situe un PER actuel hors fourchette', () => {
    expect(bandePer({ exercices, titres, serie, perActuel: 15 })!.situation).toBe('au-dessus');
    expect(bandePer({ exercices, titres, serie, perActuel: 6 })!.situation).toBe('sous');
    const sans = bandePer({ exercices, titres, serie, perActuel: null })!;
    expect(sans.situation).toBeNull();
    expect(sans.position).toBeNull();
  });

  it('écarte et COMPTE un exercice en perte, sans le tracer', () => {
    const avecPerte = exercices.map((e) => (e.periode === '2023' ? { ...e, resultat_net: -50_000 } : e));
    const b = bandePer({ exercices: avecPerte, titres, serie, perActuel: 9 })!;
    expect(b.points.map((p) => p.exercice)).toEqual([2021, 2022, 2024, 2025]);
    expect(b.ecartes).toEqual([{ exercice: 2023, raison: 'perte' }]);
  });

  it('écarte un exercice sans cours proche de sa clôture (historique qui commence plus tard)', () => {
    const b = bandePer({ exercices, titres, serie: serie.slice(1), perActuel: 9 })!;
    expect(b.points.map((p) => p.exercice)).toEqual([2022, 2023, 2024, 2025]);
    expect(b.ecartes).toEqual([{ exercice: 2021, raison: 'cours' }]);
  });

  it('moins de trois points : pas de bande', () => {
    expect(bandePer({ exercices: exercices.slice(0, 2), titres, serie, perActuel: 9 })).toBeNull();
  });

  it('ignore les périodes non annuelles et exige un nombre de titres', () => {
    const mixte = [...exercices, { periode: '2026-S1', resultat_net: 1 }];
    expect(bandePer({ exercices: mixte, titres, serie, perActuel: 9 })!.points).toHaveLength(5);
    expect(bandePer({ exercices, titres: null, serie, perActuel: 9 })).toBeNull();
  });

  it('ne garde que les cinq derniers exercices', () => {
    const six = [{ periode: '2020', resultat_net: 100_000 }, ...exercices];
    expect(bandePer({ exercices: six, titres, serie: [cloture(2020, 900), ...serie], perActuel: 9 })!.points.map((p) => p.exercice)).toEqual([2021, 2022, 2023, 2024, 2025]);
  });
});
