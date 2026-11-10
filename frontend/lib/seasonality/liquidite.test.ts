import { describe, it, expect } from 'vitest';
import { saisonLiquidite } from './liquidite';

const ligne = (annee: number, mois: number, valeur: number, cotees = 20, marche = 20) =>
  ({ annee, mois, valeurEchangee: valeur, seancesCotees: cotees, seancesMarche: marche, complet: true });

describe('saisonLiquidite', () => {
  it('valeur échangée rapportée au mois médian de son année, médiane sur les années', () => {
    // Deux années pleines : décembre à 2 300 puis 1 650, les autres mois à 900.
    const faits = [2023, 2024].flatMap((a) =>
      Array.from({ length: 12 }, (_, i) => ligne(a, i + 1, i === 11 ? (a === 2023 ? 2300 : 1650) : 900)),
    );
    const dec = saisonLiquidite(faits).find((x) => x.mois === 12)!;
    // Mois médian de chaque année : 900. Décembre : 2300/900 puis 1650/900 ; médiane de deux = moyenne.
    expect(dec.ratio).toBeCloseTo((2300 / 900 + 1650 / 900) / 2, 3);
    expect(dec.annees).toBe(2);
  });

  it('part des séances avec échange, cumulée sur les années', () => {
    const autres = Array.from({ length: 11 }, (_, i) => ligne(2024, i < 2 ? i + 1 : i + 2, 100));
    const faits = [ligne(2024, 3, 100, 10, 20), ligne(2025, 3, 100, 20, 20), ...autres];
    const mars = saisonLiquidite(faits).find((x) => x.mois === 3)!;
    // 2025 n'a qu'un mois connu : année écartée (moins de 6 mois). Reste 2024 : 10 / 20.
    expect(mars.partSeances).toBeCloseTo(10 / 20);
  });

  it('ignore les années de moins de 6 mois et les mois incomplets', () => {
    const faits = [ligne(2025, 1, 100), ligne(2025, 2, 900), { ...ligne(2025, 3, 5000), complet: false }];
    expect(saisonLiquidite(faits).every((x) => x.annees === 0)).toBe(true);
  });
});
