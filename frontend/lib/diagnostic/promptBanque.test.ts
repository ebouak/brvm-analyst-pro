import { describe, it, expect } from 'vitest';
import { buildDiagnosticPrompt } from './prompt';
import { computeRedFlags } from './redFlags';
import type { DiagnosticMetrics } from './metrics';

// Banque synthétique, ordres de grandeur de SGBC 2025.
const inc_n = {
  periode: '2025', revenu_total: 276e9, frais_generaux_admin: 107e9, resultat_exploitation: 122e9,
  resultat_net: 101e9, benefice_par_action: 3258, dividende_par_action: 2606, actions_en_circulation: 31_111_110,
  lignes_specifiques: { pnb: 276e9, produit_interets: 230e9, coefficient_exploitation: 38.8 },
} as never;
const inc_n1 = { periode: '2024', revenu_total: 263e9, resultat_net: 101e9, lignes_specifiques: { pnb: 263e9 } } as never;
const bal_n = {
  total_actifs: 3769e9, total_capitaux_propres: 495e9, tresorerie_equivalents: 372e9,
  lignes_specifiques: { depots_clientele: 2908e9, credits_clientele: 2546e9, taux_couverture_creances: 82 },
} as never;
const bal_n1 = { total_actifs: 3614e9, total_capitaux_propres: 452e9, lignes_specifiques: { depots_clientele: 2748e9, credits_clientele: 2475e9 } } as never;
const m = { cagr_ca: 4.9, cagr_rn: 0.1, payout_ratio: 80 } as unknown as DiagnosticMetrics;

const base = {
  code: 'SGBC', designation: 'SGBCI', secteur: 'Services financiers', cours: 39000,
  cours_bas_52s: 26000, cours_haut_52s: 40000,
  inc_n, inc_n1, bal_n, bal_n1, cf_n: null, cf_n1: null, m,
  periode_n: '2025', periode_n1: '2024',
  newsSignals: { litiges: [], insiders: [], concentration_client: [] },
  webSignals: {},
  marche: { actions: 31_111_110, flottant: 13_487_360, volMoyen30j: 7156 },
};

describe('diagnostic — banque', () => {
  it('sort du score les contrôles industriels et les dit non applicables', () => {
    const r = computeRedFlags({ inc_n, inc_n1, bal_n, bal_n1, cf_n: null, cf_n1: null, m, famille: 'banque' });
    const altman = r.checks.find((c) => c.id === 'detresse_altman')!;
    expect(altman.dataAvailable).toBe(false);
    expect(altman.evidence).toMatch(/^Non applicable à une banque/);
    expect(r.checks.find((c) => c.id === 'effet_ciseaux')!.evidence).not.toMatch(/Non applicable/);
  });

  it('sans famille, rien ne change', () => {
    const r = computeRedFlags({ inc_n, inc_n1, bal_n, bal_n1, cf_n: null, cf_n1: null, m });
    expect(r.checks.some((c) => c.evidence.startsWith('Non applicable'))).toBe(false);
  });

  it('le prompt bancaire porte PNB, dépôts, crédits et marché — pas la marge brute ni le BFR', () => {
    const redFlags = computeRedFlags({ inc_n, inc_n1, bal_n, bal_n1, cf_n: null, cf_n1: null, m, famille: 'banque' });
    const p = buildDiagnosticPrompt({ ...base, redFlags, famille: 'banque' });
    expect(p).toContain('## DONNÉES FINANCIÈRES — BANQUE');
    expect(p).toMatch(/Produit net bancaire \(PNB\) \| 276/);
    expect(p).toContain('Dépôts de la clientèle');
    expect(p).toMatch(/Coefficient d'exploitation 38\.8% \(publié\)/);
    expect(p).toMatch(/Crédits \/ dépôts 87\.\d%/);
    expect(p).toMatch(/Actions en circulation : 31/);
    expect(p).toMatch(/Volume moyen sur 30 séances : 7/);
    expect(p).not.toMatch(/\| Marge brute \|/);
    expect(p).not.toMatch(/\| BFR \|/);
    expect(p).toContain('le DCF sur free cash-flow ne s\'applique pas');
    expect(p).toContain('ne cite PAS comme lacunes la marge brute');
  });

  it('une société non financière garde le gabarit général, avec le bloc marché en plus', () => {
    const redFlags = computeRedFlags({ inc_n, inc_n1, bal_n, bal_n1, cf_n: null, cf_n1: null, m });
    const p = buildDiagnosticPrompt({ ...base, redFlags, famille: 'general' });
    expect(p).toContain('## DONNÉES FINANCIÈRES (FCFA)');
    expect(p).toMatch(/\| Marge brute \|/);
    expect(p).toContain('DCF simplifié (WACC 12–14%');
    expect(p).toContain('## DONNÉES DE MARCHÉ DU TITRE');
    expect(p).not.toContain('ne cite PAS comme lacunes');
  });
});
