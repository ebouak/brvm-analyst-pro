// ONTBF — ONATEL / Moov Africa Burkina Faso (télécom). Etats audités SYSCOHADA, FCFA bruts.
// Sources : PDF 2023 (2023+2022), MADIS fiche (2020-2024 CA+RN ; approximation 2024-2025 RN).
// Capital : 34 000 000 000 F CFA. Calcul actions : capital / nominal à déterminer.
// MADIS CA 2020-24 : 157 358 / 154 881 / 145 625 / 139 154 / 141 841 MFCFA ; RN : 31 052 / 32 374 / 22 372 / 21 129 / 21 471 MFCFA.
export default {
  ebe: {
    2022: 68643303971,
    2023: 64786043398,
  },

  income: [
    {
      periode: '2020',
      revenu_total: 157358000000, // MADIS : 157 358 MFCFA
      cout_ventes: null,
      resultat_exploitation: null,
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: 31052000000, // MADIS : 31 052 MFCFA
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
    {
      periode: '2021',
      revenu_total: 154881000000, // MADIS : 154 881 MFCFA
      cout_ventes: null,
      resultat_exploitation: null,
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: 32374000000, // MADIS : 32 374 MFCFA
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
    {
      periode: '2022',
      revenu_total: 145625176508,
      cout_ventes: null, // souvent null télécom
      resultat_exploitation: 35677975444,
      charges_financieres_nettes: 4176077611, // |RESULTAT FINANCIER -3 068 324 398|
      resultat_avant_impots: 32609654048, // RES ACT ORD 32 609 654 048 + RES HAO 0
      impots: 10237316650, // Impôts sur le résultat
      resultat_net: 22372337586,
      actions_en_circulation: null, // à déterminer (capital / nominal)
      benefice_par_action: null,
      dividende_par_action: 0,
    },
    {
      periode: '2023',
      revenu_total: 139153817144, // CHIFFRE D'AFFAIRES
      cout_ventes: null,
      resultat_exploitation: 33311787154,
      charges_financieres_nettes: 3042421169, // |RESULTAT FINANCIER -3 042 421 169|
      resultat_avant_impots: 30269365985, // RES ACT ORD 30 269 365 985 + RES HAO 0
      impots: 9140089200, // Impôts sur le résultat
      resultat_net: 21129276785,
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
    {
      periode: '2024',
      revenu_total: 141841000000, // MADIS : 141 841 MFCFA
      cout_ventes: null,
      resultat_exploitation: null,
      charges_financieres_nettes: null,
      resultat_avant_impots: null,
      impots: null,
      resultat_net: 21471000000, // MADIS : 21 471 MFCFA
      actions_en_circulation: null,
      benefice_par_action: null,
      dividende_par_action: 0,
    },
  ],

  balance: [
    {
      periode: '2022',
      total_actifs: 269895440922,
      total_actif_non_courant: 176772017244,
      actifs_incorporels: 65564504909,
      immobilisations_nettes: 108889560548,
      investissements_long_terme: 317951788,
      total_actif_circulant: 40855934454,
      stocks: 1536440424,
      creances_clients: 9996620006,
      tresorerie_equivalents: 52264338323,
      total_passif: 269895440922,
      total_capitaux_propres: 63172382631,
      capital_social: 34000000000,
      reserves_benefices_non_repartis: 29172382631,
      passif_non_courant: 61609108181,
      dette_long_terme: 51348876626,
      passif_courant: 145000150336, // TOTAL PASSIF CIRCULANT (DP) 104 430 207 536 + TRESORERIE PASSIF (DT) 40 535 103 433 + écart conversion
      dette_court_terme: 40535103433, // TOTAL TRESORERIE PASSIF (DT) — includs découverts
      fournisseurs: 22597890170,
      autres_passifs_courants: 81869156663, // PASSIF CIRCULANT - fournisseurs (includs découverts)
    },
    {
      periode: '2023',
      total_actifs: 288000217024,
      total_actif_non_courant: 185463161197,
      actifs_incorporels: 65519350476,
      immobilisations_nettes: 119196857627,
      investissements_long_terme: 746953094,
      total_actif_circulant: 46574949603,
      stocks: 2172342699,
      creances_clients: 10782978048,
      tresorerie_equivalents: 55960299724,
      total_passif: 288000217024,
      total_capitaux_propres: 61929278606,
      capital_social: 34000000000,
      reserves_benefices_non_repartis: 27929278606,
      passif_non_courant: 66984694692,
      dette_long_terme: 55701876306,
      passif_courant: 159075208578, // TOTAL PASSIF CIRCULANT (DP) 108 665 097 111 + TRESORERIE PASSIF (DT) 50 410 111 467
      dette_court_terme: 50410111467, // TOTAL TRESORERIE PASSIF (DT) — includs découverts
      fournisseurs: 19393077582,
      autres_passifs_courants: 89272019529, // PASSIF CIRCULANT - fournisseurs (includs découverts + autres)
    },
  ],

  cash: [
    {
      periode: '2022',
      flux_exploitation: 74612768389,
      resultat_net: 22372337586,
      depreciation_amortissement: 33965328527, // EBE 68 643 303 971 - REX 35 677 975 444
      variation_bfr: 19275099466,
      flux_investissement: -40441105912,
      investissements_ppe: 36639223183,
      flux_financement: -39608641636,
      remboursement_dette: 13974266837,
      dividendes_verses: 32374147200,
      variation_tresorerie: -5436979153,
      tresorerie_debut_periode: 11166274113, // approx
      tresorerie_fin_periode: 5550188257, // tréso actif (52.264M) - tréso passif (40.535M) = 11.729M ~ 11.729 Mds
    },
    {
      periode: '2023',
      flux_exploitation: 50983087782,
      resultat_net: 21129276785,
      depreciation_amortissement: 31474256244, // EBE 64 786 043 398 - REX 33 311 787 154
      variation_bfr: -1620445247,
      flux_investissement: -39142813365,
      investissements_ppe: 36198565392,
      flux_financement: -18019381120,
      remboursement_dette: 14496339022,
      dividendes_verses: 22372380800,
      variation_tresorerie: -6179106703,
      tresorerie_debut_periode: 11729294960, // tréso 2022 actif - passif
      tresorerie_fin_periode: 5550188257, // tréso 2023 actif (55.960M) - passif (50.410M) = 5.550M
    },
  ],
};
