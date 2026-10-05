import { describe, expect, it } from 'vitest';
import { champsManquants, construirePatches, schemaComplement, verifierComplement } from '../src/annuel/complement.js';

const M = 1e6;
const lecture = (x: object) => schemaComplement.parse({ devise_source: 'fcfa', exercice: 2025, ...x });

describe('champsManquants', () => {
  it('ne vise que les champs vides des lignes existantes', () => {
    const m = champsManquants('general', {
      income_statements: { resultat_exploitation: 10, charges_financieres_nettes: null },
      balance_sheets: { dette_court_terme: null, dette_long_terme: 5, tresorerie_equivalents: 3, total_actif_circulant: 1, passif_courant: 1, total_capitaux_propres: 9 },
      cash_flow_statements: null, // pas de ligne : elle sera créée
    });
    expect(m.map((x) => x.champ)).toEqual([
      'charges_financieres_nettes', 'resultat_avant_impots', 'impots', 'benefice_par_action', 'total_actifs', 'dette_court_terme',
      // ligne de flux absente : tous ses champs sont à fournir (création)
      'flux_exploitation', 'depreciation_amortissement', 'depenses_capital', 'investissements_ppe',
    ]);
  });

  it('banques : clés de lignes_specifiques', () => {
    const m = champsManquants('banque', {
      income_statements: {},
      balance_sheets: { total_capitaux_propres: 100, lignes_specifiques: { credits_clientele: 50, depots_clientele: 70 } },
      cash_flow_statements: null,
    });
    expect(m.map((x) => x.champ)).toEqual([
      'resultat_avant_impots', 'impots', 'benefice_par_action', 'coefficient_exploitation',
      'ratio_solvabilite', 'creances_douteuses', 'taux_couverture_creances', 'ratio_liquidite',
    ]);
  });
});

describe('verifierComplement — ancrage sur les chiffres déjà en base', () => {
  const base = { revenu_total: 500 * M, resultat_net: 40 * M, total_actifs: 900 * M };

  it('accepte une relecture qui retrouve les ancres à ±2 %', () => {
    const v = verifierComplement(lecture({ revenu_total: 500 * M, resultat_net: 40.3 * M, dette_long_terme: 120 * M }), 2025, base);
    expect(v.ok).toBe(true);
    expect(v.ancres).toBe(2);
  });

  it('REJETTE une erreur d’unité (chiffre d’affaires lu en milliers)', () => {
    const v = verifierComplement(lecture({ revenu_total: 500_000, dette_long_terme: 120_000 }), 2025, base);
    expect(v.ok).toBe(false);
  });

  it('REJETTE la colonne de l’exercice précédent', () => {
    expect(verifierComplement(lecture({ exercice: 2024, revenu_total: 500 * M }), 2025, base).ok).toBe(false);
  });

  it('REJETTE sans ancre comparable : l’exercice n’est pas prouvé', () => {
    const v = verifierComplement(lecture({ dette_long_terme: 120 * M }), 2025, base);
    expect(v.ok).toBe(false);
    expect(v.motifs.join()).toMatch(/aucune ancre/);
  });

  it('REJETTE les ratios bancaires hors bornes et les incohérences', () => {
    expect(verifierComplement(lecture({ revenu_total: 500 * M, ratio_solvabilite: 1250 }), 2025, base).ok).toBe(false);
    expect(verifierComplement(lecture({ revenu_total: 500 * M, creances_douteuses: 90, credits_clientele: 50 }), 2025, base).ok).toBe(false);
    expect(verifierComplement(lecture({ revenu_total: 500 * M, total_capitaux_propres: 1000 * M }), 2025, base).ok).toBe(false);
  });
});

describe('construirePatches — jamais d’écrasement', () => {
  it('n’écrit que les champs manquants que le PDF fournit, arrondit les colonnes, garde les ratios en %', () => {
    const manquants = [
      { table: 'income_statements' as const, champ: 'charges_financieres_nettes' },
      { table: 'balance_sheets' as const, champ: 'dette_court_terme' },
      { table: 'balance_sheets' as const, champ: 'ratio_solvabilite', ls: true },
    ];
    const p = construirePatches(manquants, lecture({ charges_financieres_nettes: 12.6 * M, dette_court_terme: null, ratio_solvabilite: 13.4, dette_long_terme: 999 }));
    expect(p).toEqual([
      { table: 'income_statements', colonnes: { charges_financieres_nettes: 12_600_000 }, ls: {} },
      { table: 'balance_sheets', colonnes: {}, ls: { ratio_solvabilite: 13.4 } },
    ]);
  });
});
