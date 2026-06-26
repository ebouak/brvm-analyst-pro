// UNLC — Unilever Côte d'Ivoire (FMCG). SYSCOHADA, FCFA bruts.
// Source : données MADIS (2022-2023 en base depuis PDF audité).
// ⚠️ MADIS fiche externe erronée (CA 71.5 Mds) — données PDF/DB (CA 34.7 Mds 2023) sont les vraies.
// ⚠️ 2024-2025 non publiés → max 2023.
// ⚠️ 2022 bilan : écart = DCT (16.4 Mds) → découverts non inclus dans PC. Corrigé.
// ⚠️ 2023 balance : sous-totaux MADIS null (PRSC stub incomplet) → conserve total actif/passif.
// ⚠️ CP 2022 négatif (−11.3 Mds) = réel (pertes cumulées Unilever CI).
export default {
  ebe: {},

  income: [
    {
      periode: '2022',
      revenu_total: 36174563379,
      cout_ventes: null,
      resultat_exploitation: -6258148368, // perte exploitation 2022
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: -6908362002, // perte nette 2022
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
    {
      periode: '2023',
      revenu_total: 34682083215,
      cout_ventes: null,
      resultat_exploitation: 1573553337,
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: 640334855,
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
  ],

  balance: [
    {
      periode: '2022',
      total_actifs: 24484387975,
      total_actif_non_courant: null,
      actifs_incorporels: null,
      immobilisations_nettes: null,
      investissements_long_terme: null,
      total_actif_circulant: null,
      stocks: null,
      creances_clients: null,
      tresorerie_equivalents: null,
      total_passif: 24484387975,
      total_capitaux_propres: -11299190951, // négatif réel
      capital_social: null,
      reserves_benefices_non_repartis: null,
      passif_non_courant: 3827299415,
      dette_long_terme: null,
      passif_courant: 31909742309, // 15 548 055 734 + 16 361 686 575 (découverts)
      dette_court_terme: 16361686358,
      fournisseurs: null,
      autres_passifs_courants: null,
    },
    {
      periode: '2023',
      total_actifs: 23009562675,
      total_actif_non_courant: null,
      actifs_incorporels: null,
      immobilisations_nettes: null,
      investissements_long_terme: null,
      total_actif_circulant: null,
      stocks: null,
      creances_clients: null,
      tresorerie_equivalents: null,
      total_passif: 23009562675,
      total_capitaux_propres: null,
      capital_social: null,
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
      periode: '2022',
      flux_exploitation: -8489231232,
      resultat_net: -6908362002,
      depreciation_amortissement: null,
      variation_bfr: null,
      flux_investissement: -186089798,
      investissements_ppe: null,
      flux_financement: -89234657,
      remboursement_dette: null,
      dividendes_verses: null,
      variation_tresorerie: null,
      tresorerie_debut_periode: null,
      tresorerie_fin_periode: null,
    },
    {
      periode: '2023',
      flux_exploitation: 2283142863,
      resultat_net: 640334855,
      depreciation_amortissement: null,
      variation_bfr: null,
      flux_investissement: 999745370,
      investissements_ppe: null,
      flux_financement: 144470374,
      remboursement_dette: null,
      dividendes_verses: null,
      variation_tresorerie: null,
      tresorerie_debut_periode: null,
      tresorerie_fin_periode: null,
    },
  ],
};
