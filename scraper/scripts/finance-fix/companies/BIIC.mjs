// BIIC — Banque Internationale Pour L'Industrie et Le Commerce (banque). IFRS, FCFA millions → bruts.
// Source : Rapport d'activités annuel et états financiers IFRS 2025 (états audités, Bénin).
// ⚠️ IFRS (non SYSCOHADA) — structure bancaire : marges nettes d'intérêts, coût du risque, commissions.
// ⚠️ Première adoption IFRS : date d'ouverture 01.01.2024 (retraité depuis publié 01.01.2024 SYSCOHADA).
// ⚠️ Montants convertis millions → FCFA bruts (× 1 000 000).
// → revenu_total = Intérêts et produits assimilés (ligne bancaire la plus proche du CA).
// → resultat_exploitation = Résultat d'exploitation (après coût du risque).
// → Coût du risque 2025 = +5 075 M (reprise nette) vs -198 M 2024.
// → Résultat net 2025 = 36 237 M (+24,8% vs 29 058 M 2024).
// → Bilans équilibrés : total actifs 2025 = 1 844 600 M, equity 135 118 M.
// → Flux de trésorerie : non fourni dans les états transmis — cash[] vide.
export default {
  ebe: {},

  income: [
    {
      periode: '2024',
      revenu_total: 82330000000, // Intérêts et produits assimilés
      cout_ventes: null, // N/A bancaire
      resultat_exploitation: 30662000000,
      charges_financieres_nettes: -46926000000, // Intérêts et charges assimilées
      resultat_avant_impots: 30733000000,
      impots: -1675000000,
      resultat_net: 29058000000,
      actions_en_circulation: 57771370, // 29 058 M / 503 FCFA BPA (arrondi)
      benefice_par_action: 503,
      dividende_par_action: null,
    },
    {
      periode: '2025',
      revenu_total: 100361000000, // Intérêts et produits assimilés
      cout_ventes: null,
      resultat_exploitation: 41446000000,
      charges_financieres_nettes: -59548000000,
      resultat_avant_impots: 41446000000,
      impots: -5209000000,
      resultat_net: 36237000000,
      actions_en_circulation: 57793459, // 36 237 M / 627 FCFA BPA (arrondi)
      benefice_par_action: 627,
      dividende_par_action: null, // 15 474 M distribués en 2025 (exercice antérieur)
    },
  ],

  balance: [
    {
      // Ouverture IFRS — retraitement première adoption (01.01.2024 publié → IFRS)
      periode: '2024-01-01',
      total_actifs: 1336706000000,
      total_actif_non_courant: null,
      actifs_incorporels: 1523000000,
      immobilisations_nettes: 11568000000,
      investissements_long_terme: 9717000000, // Instruments CP FVOCI
      total_actif_circulant: null,
      stocks: null,
      creances_clients: 672147000000, // Prêts et créances sur clientèle
      tresorerie_equivalents: 28473000000,
      total_passif: 1251530000000,
      total_capitaux_propres: 85176000000,
      capital_social: 82514000000,
      reserves_benefices_non_repartis: 515000000, // Réserves spéciales à l'ouverture
      passif_non_courant: null,
      dette_long_terme: null,
      passif_courant: null,
      dette_court_terme: null,
      fournisseurs: null,
      autres_passifs_courants: null,
    },
    {
      periode: '2024-12-31',
      total_actifs: 1516850000000,
      total_actif_non_courant: null,
      actifs_incorporels: 2394000000,
      immobilisations_nettes: 12799000000,
      investissements_long_terme: 10185000000,
      total_actif_circulant: null,
      stocks: null,
      creances_clients: 838691000000, // Prêts et créances sur clientèle
      tresorerie_equivalents: 30060000000,
      total_passif: 1402230000000,
      total_capitaux_propres: 114620000000,
      capital_social: 82514000000,
      reserves_benefices_non_repartis: 2303000000,
      passif_non_courant: null,
      dette_long_terme: null,
      passif_courant: null,
      dette_court_terme: null,
      fournisseurs: null,
      autres_passifs_courants: null,
    },
    {
      periode: '2025-12-31',
      total_actifs: 1844600000000,
      total_actif_non_courant: null,
      actifs_incorporels: 2333000000,
      immobilisations_nettes: 17588000000,
      investissements_long_terme: 9765000000,
      total_actif_circulant: null,
      stocks: null,
      creances_clients: 1151536000000, // Prêts et créances sur clientèle
      tresorerie_equivalents: 41067000000,
      total_passif: 1709482000000,
      total_capitaux_propres: 135118000000,
      capital_social: 82514000000,
      reserves_benefices_non_repartis: 6854000000,
      passif_non_courant: null,
      dette_long_terme: null,
      passif_courant: null,
      dette_court_terme: null,
      fournisseurs: null,
      autres_passifs_courants: null,
    },
  ],

  cash: [], // Tableau de flux de trésorerie non fourni — à sourcer
};
