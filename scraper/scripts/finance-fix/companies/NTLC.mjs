// NTLC — Nestlé Côte d'Ivoire (alimentaire). Etats audités SYSCOHADA, FCFA bruts.
// Sources (bfin.brvm.org) : PDF 2025 (annule et remplace 2024).
// ⚠️ PIÈGE : Layout compte de résultat atypique (noms colonnes/lignes non-standard).
//    Lire avec soin : identifier REX, D&A, RN par logique métier, pas par position.
// Capital : 2 340 000 000 F CFA (nominal à déterminer).
// Note : 2024 PDF obsolète (ne pas utiliser).
export default {
  ebe: {},

  income: [
    {
      periode: '2025',
      revenu_total: null, // à extraire PDF 2025 (SYSCOHADA, layout atypique)
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
      capital_social: 2340000000,
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
