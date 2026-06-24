// VIVO ENERGY COTE D'IVOIRE (SHEC) — FCFA bruts
// Sources : états financiers VIVO ENERGY CI (bfin.brvm.org)
//  - 2020 : colonne N-1 du PDF "Etats Financiers exercice 2021" (chiffres approuvés ;
//           le PDF standalone 2020 est marqué "PROVISOIRES NON AUDITES" — non retenu)
//  - 2021 : PDF "Etats Financiers exercice 2021"
//  - 2022 : colonne N-1 du PDF "Etats financiers provisoire - Exercice 2023"
//           (le PDF listé "exercice 2022" en base est en réalité AFRICA GLOBAL LOGISTICS — écarté)
//  - 2023 : PDF "Etats financiers provisoire - Exercice 2023"
// 2024/2025 : aucune publication d'états financiers VIVO en base -> non écrits.
// actions/BPA/DPA : nominal non indiqué dans les états condensés -> null (pas d'invention).
// cash : états VIVO = TAFIRE (emplois/ressources), pas de cash-flow direct ;
//        seuls les champs dérivables sont renseignés, le reste null.
export default {
  "ebe": {
    "2020": 708890607,
    "2021": 8244961807,
    "2022": 10254269219,
    "2023": 13229798579
  },
  "income": [
    {
      "periode": "2020",
      "revenu_total": 313564389616,
      "cout_ventes": 271290778716,
      "resultat_exploitation": -3816331166,
      "charges_financieres_nettes": 947387292,
      "resultat_avant_impots": -4753012834,
      "impots": 35000000,
      "resultat_net": -4788012834,
      "actions_en_circulation": null,
      "benefice_par_action": null,
      "dividende_par_action": null
    },
    {
      "periode": "2021",
      "revenu_total": 366643579663,
      "cout_ventes": 319674885467,
      "resultat_exploitation": 4268901912,
      "charges_financieres_nettes": 996881779,
      "resultat_avant_impots": 3272020133,
      "impots": 912397472,
      "resultat_net": 2359622661,
      "actions_en_circulation": null,
      "benefice_par_action": null,
      "dividende_par_action": null
    },
    {
      "periode": "2022",
      "revenu_total": 488901792280,
      "cout_ventes": 443902076403,
      "resultat_exploitation": 6027152226,
      "charges_financieres_nettes": 682588483,
      "resultat_avant_impots": 5344563743,
      "impots": 1795925285,
      "resultat_net": 3548638458,
      "actions_en_circulation": null,
      "benefice_par_action": null,
      "dividende_par_action": null
    },
    {
      "periode": "2023",
      "revenu_total": 550696009519,
      "cout_ventes": 499097463455,
      "resultat_exploitation": 8485512286,
      "charges_financieres_nettes": 2033818145,
      "resultat_avant_impots": 6430757225,
      "impots": 2419154477,
      "resultat_net": 4011602748,
      "actions_en_circulation": null,
      "benefice_par_action": null,
      "dividende_par_action": null
    }
  ],
  "balance": [
    {
      "periode": "2020",
      "total_actifs": 80833632309,
      "total_actif_non_courant": 55227771979,
      "actifs_incorporels": 5289688306,
      "immobilisations_nettes": 38159311311,
      "investissements_long_terme": 11778772362,
      "total_actif_circulant": 24983992955,
      "stocks": 5562614490,
      "creances_clients": 19421378465,
      "tresorerie_equivalents": 621867375,
      "total_passif": 80833632309,
      "total_capitaux_propres": 19025380993,
      "capital_social": 3150000000,
      "reserves_benefices_non_repartis": 9432000000,
      "passif_non_courant": 12931252670,
      "dette_long_terme": 12931252670,
      "passif_courant": 48828727374,
      "dette_court_terme": 18550497623,
      "fournisseurs": null,
      "autres_passifs_courants": null
    },
    {
      "periode": "2021",
      "total_actifs": 101262735128,
      "total_actif_non_courant": 57451737184,
      "actifs_incorporels": 5273300388,
      "immobilisations_nettes": 40400780369,
      "investissements_long_terme": 11777656427,
      "total_actif_circulant": 39198215483,
      "stocks": 7359868670,
      "creances_clients": 31838346813,
      "tresorerie_equivalents": 4612782461,
      "total_passif": 101262735128,
      "total_capitaux_propres": 21385003655,
      "capital_social": 3150000000,
      "reserves_benefices_non_repartis": 9432000000,
      "passif_non_courant": 13516437207,
      "dette_long_terme": 13516437207,
      "passif_courant": 66352084593,
      "dette_court_terme": 17412670687,
      "fournisseurs": null,
      "autres_passifs_courants": null
    },
    {
      "periode": "2022",
      "total_actifs": 119461700193,
      "total_actif_non_courant": 59538192910,
      "actifs_incorporels": 5247604946,
      "immobilisations_nettes": 42429083821,
      "investissements_long_terme": 11861504143,
      "total_actif_circulant": 52795839840,
      "stocks": 9001481435,
      "creances_clients": 26223552316,
      "tresorerie_equivalents": 6927590040,
      "total_passif": 119461700193,
      "total_capitaux_propres": 22903642113,
      "capital_social": 3150000000,
      "reserves_benefices_non_repartis": 8802000000,
      "passif_non_courant": 12675296717,
      "dette_long_terme": 12675296717,
      "passif_courant": 83872365208,
      "dette_court_terme": 4343761139,
      "fournisseurs": 54766723233,
      "autres_passifs_courants": 24761880836
    },
    {
      "periode": "2023",
      "total_actifs": 169830273541,
      "total_actif_non_courant": 74083943010,
      "actifs_incorporels": 5223048671,
      "immobilisations_nettes": 56335423891,
      "investissements_long_terme": 12525470448,
      "total_actif_circulant": 92371255895,
      "stocks": 8896871088,
      "creances_clients": 37950348192,
      "tresorerie_equivalents": 3043361850,
      "total_passif": 169830273541,
      "total_capitaux_propres": 25678578194,
      "capital_social": 3150000000,
      "reserves_benefices_non_repartis": 8802000000,
      "passif_non_courant": 13609237352,
      "dette_long_terme": 13609237352,
      "passif_courant": 130542457995,
      "dette_court_terme": 32831918349,
      "fournisseurs": 60244838974,
      "autres_passifs_courants": 37465700672
    }
  ],
  "cash": [
    {
      "periode": "2020",
      "flux_exploitation": null,
      "resultat_net": -4788012834,
      "depreciation_amortissement": 4525221773,
      "variation_bfr": null,
      "flux_investissement": null,
      "investissements_ppe": 7643941452,
      "flux_financement": null,
      "remboursement_dette": null,
      "dividendes_verses": 4500000000,
      "variation_tresorerie": -10376449009,
      "tresorerie_debut_periode": -7552181239,
      "tresorerie_fin_periode": -17928630248
    },
    {
      "periode": "2021",
      "flux_exploitation": null,
      "resultat_net": 2359622661,
      "depreciation_amortissement": 3976059895,
      "variation_bfr": null,
      "flux_investissement": null,
      "investissements_ppe": 6094491305,
      "flux_financement": null,
      "remboursement_dette": null,
      "dividendes_verses": 0,
      "variation_tresorerie": 5128742022,
      "tresorerie_debut_periode": -17928630248,
      "tresorerie_fin_periode": -12799888226
    },
    {
      "periode": "2022",
      "flux_exploitation": null,
      "resultat_net": 3548638458,
      "depreciation_amortissement": 4227116993,
      "variation_bfr": null,
      "flux_investissement": null,
      "investissements_ppe": 7078554085,
      "flux_financement": null,
      "remboursement_dette": null,
      "dividendes_verses": 2030000000,
      "variation_tresorerie": 15383717127,
      "tresorerie_debut_periode": -12799888226,
      "tresorerie_fin_periode": 2583828901
    },
    {
      "periode": "2023",
      "flux_exploitation": null,
      "resultat_net": 4011602748,
      "depreciation_amortissement": 4744286293,
      "variation_bfr": null,
      "flux_investissement": null,
      "investissements_ppe": 19342885085,
      "flux_financement": null,
      "remboursement_dette": null,
      "dividendes_verses": 1236666667,
      "variation_tresorerie": -32372385400,
      "tresorerie_debut_periode": 2583828901,
      "tresorerie_fin_periode": -29788556499
    }
  ]
};
