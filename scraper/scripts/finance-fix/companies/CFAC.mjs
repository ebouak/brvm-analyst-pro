// CFAC — CFAO Motors CI / CFAO Mobility CI (automobile). SYSCOHADA, FCFA bruts.
// Source : données MADIS (2022-2023 en base). 2024-2025 non disponibles en MADIS.
// ⚠️ Confusion site BRVM : PDFs étiquetés "TRACTAFRIC" sur page CFAC = erreur scraping.
//    TRACTAFRIC = PRSC (concurrent). Vérifier identité PDF avant toute extraction future.
// ⚠️ 2022 bilan quasi-reconcilié (écart 1 000 FCFA = arrondi). OK.
// ⚠️ 2023 PC MADIS = 34 293 M mais total_passif−CP−PNC = 37 619 M → découverts 3 326 M inclus.
export default {
  ebe: {},

  income: [
    {
      periode: '2022',
      revenu_total: 70092000000,
      cout_ventes: null,
      resultat_exploitation: null,
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: 3644000000,
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
    {
      periode: '2023',
      revenu_total: 77900000000,
      cout_ventes: null,
      resultat_exploitation: null,
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: 2084000000,
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
  ],

  balance: [
    {
      periode: '2022',
      total_actifs: 52169000000,
      total_actif_non_courant: null,
      actifs_incorporels: null,
      immobilisations_nettes: null,
      investissements_long_terme: null,
      total_actif_circulant: null,
      stocks: null,
      creances_clients: null,
      tresorerie_equivalents: null,
      total_passif: 51658000000, // MADIS (actif 52 169 ≠ passif 51 658, écart 511 M ~1% — toléré)
      total_capitaux_propres: 11480000000,
      capital_social: null,
      reserves_benefices_non_repartis: null,
      passif_non_courant: 2650000000,
      dette_long_terme: null,
      passif_courant: 37527000000, // MADIS DCT=0, pas de découverts — OK
      dette_court_terme: 0,
      fournisseurs: null,
      autres_passifs_courants: null,
    },
    {
      periode: '2023',
      total_actifs: 51246000000,
      total_actif_non_courant: null,
      actifs_incorporels: null,
      immobilisations_nettes: null,
      investissements_long_terme: null,
      total_actif_circulant: null,
      stocks: null,
      creances_clients: null,
      tresorerie_equivalents: null,
      total_passif: 51246000000,
      total_capitaux_propres: 11015000000,
      capital_social: null,
      reserves_benefices_non_repartis: null,
      passif_non_courant: 2612000000,
      dette_long_terme: null,
      passif_courant: 37619000000, // 34 293 + 3 326 (découverts = DCT)
      dette_court_terme: 3325000000,
      fournisseurs: null,
      autres_passifs_courants: null,
    },
  ],

  cash: [
    {
      periode: '2022',
      flux_exploitation: 9573000000,
      resultat_net: 3644000000,
      depreciation_amortissement: null,
      variation_bfr: null,
      flux_investissement: -3225000000,
      investissements_ppe: null,
      flux_financement: -3145000000,
      remboursement_dette: null,
      dividendes_verses: null,
      variation_tresorerie: null,
      tresorerie_debut_periode: null,
      tresorerie_fin_periode: null,
    },
    {
      periode: '2023',
      flux_exploitation: -167000000,
      resultat_net: 2084000000,
      depreciation_amortissement: null,
      variation_bfr: null,
      flux_investissement: -1281000000,
      investissements_ppe: null,
      flux_financement: -2212000000,
      remboursement_dette: null,
      dividendes_verses: null,
      variation_tresorerie: null,
      tresorerie_debut_periode: null,
      tresorerie_fin_periode: null,
    },
  ],
};
