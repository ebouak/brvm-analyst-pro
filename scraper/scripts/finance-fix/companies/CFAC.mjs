// CFAC — CFAO Motors CI (rebranding CFAO Mobility CI en 2024). Etats audités SYSCOHADA, FCFA bruts.
// Sources (bfin.brvm.org) : PDF 2025 (CFAO Mobility CI post-rebranding), PDF 2024 (transition).
// ⚠️ PIÈGE CRITIQUE : PDFs sur site BRVM de CFAC peuvent être étiqu. TRACTAFRIC (erreur site).
//    Vérifier en-tête du PDF : doit contenir "CFAO Motors" ou "CFAO Mobility", PAS "TRACTAFRIC".
//    TRACTAFRIC = PRSC (société distincte, concurrente).
// Capital : 1 250 000 000 F CFA (nominal à déterminer).
// Note : 2023 et antérieures disponibles si accessible.
export default {
  ebe: {},

  income: [
    {
      periode: '2024',
      revenu_total: null, // à extraire PDF 2024 (transition rebranding)
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
      periode: '2025',
      revenu_total: null, // à extraire PDF 2025 (CFAO Mobility post-rebranding)
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
  ],

  balance: [
    {
      periode: '2024',
      total_actifs: null,
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
      capital_social: 1250000000,
      reserves_benefices_non_repartis: null,
      passif_non_courant: null,
      dette_long_terme: null,
      passif_courant: null,
      dette_court_terme: null,
      fournisseurs: null,
      autres_passifs_courants: null,
    },
    {
      periode: '2025',
      total_actifs: null,
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
      capital_social: 1250000000,
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
      periode: '2024',
      flux_exploitation: null,
      resultat_net: null,
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
    {
      periode: '2025',
      flux_exploitation: null,
      resultat_net: null,
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
