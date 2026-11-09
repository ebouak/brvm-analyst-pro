import { describe, expect, it } from 'vitest';
import { pointsCles } from './pointsCles';

const sg = {
  famille: 'banque' as const,
  courant: { year: 2025, revenue: 276_048e6, net_income: 101_351e6 },
  precedent: { year: 2024, revenue: 263_207e6, net_income: 101_228e6 },
  dividendes: [{ exercice: 2025, montant: 2293.28 }, { exercice: 2024, montant: 1900 }],
};

describe('pointsCles', () => {
  it('nomme le PNB pour une banque et donne l’évolution', () => {
    const p = pointsCles(sg);
    expect(p[0]).toBe('En 2025, le produit net bancaire a progressé de 4,9 %, à 276,05 Md FCFA.');
  });
  it('qualifie une quasi-stabilité du résultat', () => {
    expect(pointsCles(sg)[1]).toBe('Le résultat net est resté stable (+0,1 %), à 101,35 Md FCFA.');
  });
  it('compare le dividende à l’exercice précédent', () => {
    expect(pointsCles(sg)[2].replace(/[  ]/g, ' ')).toBe('Dividende net de 2 293,28 FCFA par action au titre de 2025, contre 1 900 FCFA pour 2024 (+20,7 %).');
  });
  it('signale le passage d’une perte à un bénéfice sans pourcentage trompeur', () => {
    const p = pointsCles({ famille: 'general', courant: { year: 2025, revenue: 1e9, net_income: 7e8 }, precedent: { year: 2024, revenue: 1e9, net_income: -1.65e8 }, dividendes: [] });
    expect(p).toContain('Le résultat net est redevenu positif, à 700,0 M FCFA, après une perte en 2024.');
  });
  it('ne compare pas deux exercices non consécutifs et ne dit rien sans données', () => {
    expect(pointsCles({ famille: 'general', courant: null, precedent: null, dividendes: [] })).toEqual([]);
    const p = pointsCles({ famille: 'general', courant: { year: 2025, revenue: 2e9, net_income: null }, precedent: { year: 2022, revenue: 1e9, net_income: null }, dividendes: [] });
    expect(p).toEqual(['Chiffre d’affaires 2025 : 2,00 Md FCFA.']);
  });
  it('n’annonce pas de hausse de dividende entre exercices non consécutifs', () => {
    const p = pointsCles({ famille: 'general', courant: null, precedent: null, dividendes: [{ exercice: 2025, montant: 100 }, { exercice: 2022, montant: 50 }] });
    expect(p).toEqual(['Dividende net de 100 FCFA par action au titre de 2025.']);
  });
});
