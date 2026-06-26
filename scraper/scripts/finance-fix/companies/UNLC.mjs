// UNLC — Unilever Côte d'Ivoire (FMCG). Etats audités SYSCOHADA, FCFA bruts.
// Sources (bfin.brvm.org) : PDF 2023 (2023), PDF 2022 (2022), PDF 2021 (2021).
// Limitation : 2024-2025 non publiés → max 2023.
// Capital : 1 900 000 000 F CFA. Actions : à déterminer (capital / nominal).
// MADIS fiches : CA 2023 = 71 543 MFCFA, RN 2023 = 6 287 MFCFA.
export default {
  ebe: {
    2023: null, // à extraire du PDF
  },

  income: [
    {
      periode: '2021',
      revenu_total: null, // à extraire PDF 2021
      cout_ventes: null,
      resultat_exploitation: null,
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: null,
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
    {
      periode: '2022',
      revenu_total: null, // à extraire PDF 2022
      cout_ventes: null,
      resultat_exploitation: null,
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: null,
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
    {
      periode: '2023',
      revenu_total: 71543000000, // MADIS : 71 543 MFCFA (validé)
      cout_ventes: null,
      resultat_exploitation: null,
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: 6287000000, // MADIS : 6 287 MFCFA (validé)
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
  ],

  balance: [
    {
      periode: '2023',
      total_actifs: null, // à extraire PDF 2023
      total_actif_non_courant: null,
      actifs_incorporels: null,
      immobilisations_nettes: null,
      investissements_long_terme: null,
      total_actif_circulant: null,
      stocks: null,
      creances_clients: null,
      tresorerie_equivalents: null,
      total_passif: null,
      total_capitaux_propres: null,
      capital_social: 1900000000,
      reserves_benefices_non_repartis: null,
      passif_non_courant: null,
      dette_long_terme: null,
      passif_courant: null,
      dette_court_terme: null,
      fournisseurs: null,
      autres_passifs_courants: null,
    },
  ],

  cash: [
    {
      periode: '2023',
      flux_exploitation: null,
      resultat_net: 6287000000,
      depreciation_amortissement: null,
      variation_bfr: null,
      flux_investissement: null,
      investissements_ppe: null,
      flux_financement: null,
      remboursement_dette: null,
      dividendes_verses: null,
      variation_tresorerie: null,
      tresorerie_debut_periode: null,
      tresorerie_fin_periode: null,
    },
  ],
};
