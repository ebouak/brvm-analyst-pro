import { describe, it, expect } from 'vitest';
import { checkStatement } from '@/lib/import/fullGuardrails';
import type { YearStatement } from '@/lib/import/fullStatement';

const base: YearStatement = {
  periode: '2025', revenu_total: 197629996000, cout_ventes: 110612438000,
  marge_brute: 87017558000, frais_generaux_admin: 30126881000, depenses_rd: 29620649000,
  autres_depenses: null, resultat_exploitation: 44484941000, charges_financieres_nettes: -2213587000,
  resultat_avant_impots: 20220189000, impots: -4711534000, resultat_net: 15508655000,
  benefice_par_action: 760, benefice_par_action_dilue: 760, dividende_par_action: 502,
  actions_en_circulation: 20406297, total_actifs: 199116293000, total_actif_circulant: 86256798000,
  tresorerie_equivalents: 9488637000, investissements_court_terme: 0, creances_clients: 78270148000,
  stocks: 7986650000, autres_actifs_courants: 0, total_actif_non_courant: 103370859000,
  immobilisations_nettes: 99076870000, goodwill: 0, actifs_incorporels: 184157000,
  investissements_long_terme: 3085720000, total_passif: 199116293000, passif_courant: 55680750000,
  fournisseurs: 41633570000, dette_court_terme: 14047180000, autres_passifs_courants: 0,
  passif_non_courant: 796559000, dette_long_terme: 796559000, total_capitaux_propres: 142638984000,
  capital_social: 20406297000, reserves_benefices_non_repartis: 106724033000,
  flux_exploitation: 38740600000, depreciation_amortissement: 19109395000, variation_bfr: 8174151000,
  flux_investissement: -19687331000, investissements_ppe: -19502640000, acquisitions: -164345000,
  flux_financement: -10952426000, dividendes_verses: -7930821000, remboursement_dette: -3021604000,
  emissions_actions: 0, variation_tresorerie: 8100843000, tresorerie_debut_periode: -12659387000,
  tresorerie_fin_periode: -4558544000, depenses_capital: -19502640000, flux_tresorerie_disponible: 19237960000,
};

describe('checkStatement', () => {
  it('accepte un exercice cohérent (PALC 2025)', () => {
    const r = checkStatement(base, false);
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('rejette une magnitude suspecte (CA < 1 Md)', () => {
    const r = checkStatement({ ...base, revenu_total: 197 }, false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/magnitude/);
  });

  it('rejette un bilan non équilibré (actif != passif > 1%)', () => {
    const r = checkStatement({ ...base, total_passif: 150000000000 }, false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/bilan/);
  });

  it('rejette un résultat net incohérent', () => {
    const r = checkStatement({ ...base, resultat_net: 999 }, false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/résultat/);
  });

  it("rejette un BPA incohérent avec résultat/actions", () => {
    const r = checkStatement({ ...base, benefice_par_action: 99 }, false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/BPA/);
  });

  it('banque : ne vérifie pas marge_brute', () => {
    const bank = { ...base, cout_ventes: null, marge_brute: null };
    const r = checkStatement(bank, true);
    expect(r.ok).toBe(true);
  });
});
