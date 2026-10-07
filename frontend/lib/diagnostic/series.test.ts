import { describe, it, expect } from 'vitest';
import { seriesAnnuelles, anneeDe, assez } from './series';

const inc = (periode: string, pnb: number, rn: number, fg: number, dpa: number | null = null, bpa: number | null = null) =>
  ({ periode, revenu_total: pnb, resultat_net: rn, frais_generaux_admin: fg, dividende_par_action: dpa, benefice_par_action: bpa,
     lignes_specifiques: { pnb } }) as never;
const bal = (periode: string, actifs: number, cp: number, credits: number, depots: number) =>
  ({ periode, total_actifs: actifs, total_capitaux_propres: cp, lignes_specifiques: { credits_clientele: credits, depots_clientele: depots } }) as never;

describe('séries annuelles', () => {
  it('ordonne les exercices, calcule les ratios en %, banque', () => {
    const s = seriesAnnuelles({
      famille: 'banque',
      income: [inc('2025', 276, 101, 107, 2606, 3258), inc('2024', 263, 101, 99.7)],
      balance: [bal('2025', 3769, 495, 2546, 2908), bal('2024', 3614, 452, 2475, 2748)],
      cashflow: [],
    });
    expect(s.map((p) => p.annee)).toEqual(['2024', '2025']);
    const p = s[1]!;
    expect(p.coefExploitation).toBeCloseTo((107 / 276) * 100, 6);
    expect(p.roe).toBeCloseTo((101 / 495) * 100, 6);
    expect(p.transformation).toBeCloseTo((2546 / 2908) * 100, 6);
    expect(p.distribution).toBeCloseTo((2606 / 3258) * 100, 6);
    expect(p.dettesFinancieres).toBeNull();      // sans objet pour une banque
  });

  it('périodes au format date (BICB) acceptées, période d’ouverture écartée', () => {
    expect(anneeDe('2025-12-31')).toBe('2025');
    expect(anneeDe('2024-01-01')).toBeNull();
    const s = seriesAnnuelles({ famille: 'banque', income: [], balance: [bal('2025-12-31', 1, 1, 1, 1), bal('2024-01-01', 2, 2, 2, 2)], cashflow: [] });
    expect(s.map((p) => p.annee)).toEqual(['2025']);
  });

  it('un manque reste null, jamais zéro', () => {
    const s = seriesAnnuelles({ famille: 'general', income: [inc('2025', 100, 10, 50)], balance: [], cashflow: [] });
    expect(s[0]!.roe).toBeNull();
    expect(s[0]!.dpa).toBeNull();
    expect(assez(s, 'margeNette')).toBe(false);
  });

  it('borne le nombre d’exercices aux plus récents', () => {
    const income = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'].map((a) => inc(a, 1, 1, 1));
    expect(seriesAnnuelles({ famille: 'general', income, balance: [], cashflow: [], max: 5 }).map((p) => p.annee))
      .toEqual(['2021', '2022', '2023', '2024', '2025']);
  });
});
