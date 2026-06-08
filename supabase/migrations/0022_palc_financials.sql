-- ============================================================
-- PALMCI (PALC) — États financiers au 31/12/2025 et 31/12/2024
-- Source : Document PDF "Etats financiers - Exercice 2025 - PALM CI"
-- Toutes les valeurs sont en FCFA (PDF en milliers × 1 000)
-- ============================================================

-- ── Nombre d'actions ─────────────────────────────────────────
UPDATE public.brvm_instruments
SET shares = 15447862,
    shares_source = 'états financiers 2025 (div 7 754 327 kFCFA / 502 FCFA/action)'
WHERE code = 'PALC';

-- ── Compte de résultat ───────────────────────────────────────
INSERT INTO public.income_statements (
  code, periode, type_periode,
  revenu_total, cout_ventes, marge_brute,
  resultat_exploitation,
  charges_financieres_nettes,
  resultat_avant_impots, impots, resultat_net,
  benefice_par_action, dividende_par_action
) VALUES
-- 2025
(
  'PALC', '2025', 'annuel',
  197629996000,               -- CA
  85706070000,                -- Achats matières premières
  59256000,                   -- Marge commerciale
  18163004000,                -- Résultat d'exploitation
  -1283005000,                -- Frais financiers nets (revenus 3 533 693 - frais 1 283 005 → net +2 213 587 ; on stocke le coût brut)
  20220189000,                -- RAO (20 376 592) + HAO (-156 403) = 20 220 189
  -4711534000,                -- Impôts
  15508655000,                -- Résultat net
  1004.00,                    -- BPA ≈ 15 508 655 000 / 15 447 862
  502.00                      -- Dividende proposé
),
-- 2024
(
  'PALC', '2024', 'annuel',
  172182502000,
  55737873000,
  254864000,
  19393765000,
  -2079339000,
  22119343000,                -- RAO (21 924 637) + HAO (194 706)
  -6257700000,
  15861643000,
  1027.00,                    -- BPA ≈ 15 861 643 000 / 15 447 862
  513.00                      -- Dividende versé 7 930 821 000 / 15 447 862 ≈ 513
)
ON CONFLICT (code, periode, type_periode) DO UPDATE SET
  revenu_total              = EXCLUDED.revenu_total,
  cout_ventes               = EXCLUDED.cout_ventes,
  marge_brute               = EXCLUDED.marge_brute,
  resultat_exploitation     = EXCLUDED.resultat_exploitation,
  charges_financieres_nettes= EXCLUDED.charges_financieres_nettes,
  resultat_avant_impots     = EXCLUDED.resultat_avant_impots,
  impots                    = EXCLUDED.impots,
  resultat_net              = EXCLUDED.resultat_net,
  benefice_par_action       = EXCLUDED.benefice_par_action,
  dividende_par_action      = EXCLUDED.dividende_par_action;

-- ── Bilan ────────────────────────────────────────────────────
INSERT INTO public.balance_sheets (
  code, periode, type_periode,
  total_actifs,
  total_actif_circulant,
  tresorerie_equivalents,
  creances_clients,
  stocks,
  total_actif_non_courant,
  immobilisations_nettes,
  investissements_long_terme,
  total_passif,
  passif_courant,
  dette_court_terme,
  passif_non_courant,
  dette_long_terme,
  total_capitaux_propres,
  capital_social,
  reserves_benefices_non_repartis
) VALUES
-- 2025
(
  'PALC', '2025', 'annuel',
  199116293000,               -- TOTAL ACTIF
  86256798000,                -- ACTIF CIRCULANT
  9488637000,                 -- Trésorerie actif
  78270148000,                -- Créances et emplois assimilés
  7986650000,                 -- Stocks et encours
  103370859000,               -- ACTIF IMMOBILISE
  99076870000,                -- Immobilisations corporelles
  3085720000,                 -- Immobilisations financières
  199116293000,               -- TOTAL PASSIF
  41633570000,                -- Passif circulant
  14047180000,                -- Trésorerie passif (dettes bancaires CT)
  796559000,                  -- Dettes financières LT
  796559000,
  142638984000,               -- CAPITAUX PROPRES
  20406297000,                -- Capital social
  106724033000                -- Réserves + Report (40 451 282 + 66 272 751)
),
-- 2024
(
  'PALC', '2024', 'annuel',
  202603319000,
  93705506000,
  9362246000,
  82699056000,
  11006450000,
  99535567000,
  96310107000,
  2961386000,
  202603319000,
  41473506000,
  22021633000,
  4047029000,
  4047029000,
  135061151000,
  20406297000,
  98793211000                 -- 40 451 282 + 58 341 929
)
ON CONFLICT (code, periode, type_periode) DO UPDATE SET
  total_actifs                    = EXCLUDED.total_actifs,
  total_actif_circulant           = EXCLUDED.total_actif_circulant,
  tresorerie_equivalents          = EXCLUDED.tresorerie_equivalents,
  creances_clients                = EXCLUDED.creances_clients,
  stocks                          = EXCLUDED.stocks,
  total_actif_non_courant         = EXCLUDED.total_actif_non_courant,
  immobilisations_nettes          = EXCLUDED.immobilisations_nettes,
  investissements_long_terme      = EXCLUDED.investissements_long_terme,
  total_passif                    = EXCLUDED.total_passif,
  passif_courant                  = EXCLUDED.passif_courant,
  dette_court_terme               = EXCLUDED.dette_court_terme,
  passif_non_courant              = EXCLUDED.passif_non_courant,
  dette_long_terme                = EXCLUDED.dette_long_terme,
  total_capitaux_propres          = EXCLUDED.total_capitaux_propres,
  capital_social                  = EXCLUDED.capital_social,
  reserves_benefices_non_repartis = EXCLUDED.reserves_benefices_non_repartis;

-- ── Flux de trésorerie ───────────────────────────────────────
INSERT INTO public.cash_flow_statements (
  code, periode, type_periode,
  flux_exploitation,
  resultat_net,
  depreciation_amortissement,
  variation_bfr,
  flux_investissement,
  investissements_ppe,
  flux_financement,
  dividendes_verses,
  remboursement_dette,
  variation_tresorerie,
  tresorerie_debut_periode,
  tresorerie_fin_periode,
  depenses_capital,
  flux_tresorerie_disponible
) VALUES
-- 2025
(
  'PALC', '2025', 'annuel',
  38740600000,                -- Flux activités opérationnelles
  15508655000,                -- Résultat net
  19109395000,                -- Dotations amortissements
  8174151000,                 -- Variation BFR
  -19687331000,               -- Flux investissement
  -19502640000,               -- Décaissements immo corporelles (Capex)
  -10952426000,               -- Flux financement
  -7930821000,                -- Dividendes versés
  -3021604000,                -- Remboursement emprunts
  8100843000,                 -- Variation trésorerie nette
  -12659387000,               -- Trésorerie nette 1er janvier
  -4558544000,                -- Trésorerie nette 31 décembre
  -19502640000,               -- Capex
  19237960000                 -- FCF = flux exploitation - capex (38 740 600 - 19 502 640)
),
-- 2024
(
  'PALC', '2024', 'annuel',
  28463195000,
  15861643000,
  18179127000,
  -4839960000,
  -19822162000,
  -20003550000,
  -13067785000,
  -9675923000,
  -3402158000,
  -4426752000,
  -8232635000,
  -12659387000,
  -20003550000,
  8459645000                  -- FCF = 28 463 195 - 20 003 550
)
ON CONFLICT (code, periode, type_periode) DO UPDATE SET
  flux_exploitation           = EXCLUDED.flux_exploitation,
  resultat_net                = EXCLUDED.resultat_net,
  depreciation_amortissement  = EXCLUDED.depreciation_amortissement,
  variation_bfr               = EXCLUDED.variation_bfr,
  flux_investissement         = EXCLUDED.flux_investissement,
  investissements_ppe         = EXCLUDED.investissements_ppe,
  flux_financement            = EXCLUDED.flux_financement,
  dividendes_verses           = EXCLUDED.dividendes_verses,
  remboursement_dette         = EXCLUDED.remboursement_dette,
  variation_tresorerie        = EXCLUDED.variation_tresorerie,
  tresorerie_debut_periode    = EXCLUDED.tresorerie_debut_periode,
  tresorerie_fin_periode      = EXCLUDED.tresorerie_fin_periode,
  depenses_capital            = EXCLUDED.depenses_capital,
  flux_tresorerie_disponible  = EXCLUDED.flux_tresorerie_disponible;

-- ── Table fundamentals (ratios rapides) ──────────────────────
INSERT INTO public.fundamentals (code, year, revenue, net_income, equity, cash, debt, bfr, source, source_file)
VALUES
  ('PALC', 2025, 197629996000, 15508655000, 142638984000, 9488637000, 14843739000, 44623228000, 'pdf-manual', '20260323-etats-financiers-2025-palm-ci.pdf'),
  ('PALC', 2024, 172182502000, 15861643000, 135061151000, 9362246000, 26068662000, 52232000000, 'pdf-manual', '20260323-etats-financiers-2025-palm-ci.pdf')
ON CONFLICT (code, year) DO UPDATE SET
  revenue    = EXCLUDED.revenue,
  net_income = EXCLUDED.net_income,
  equity     = EXCLUDED.equity,
  cash       = EXCLUDED.cash,
  debt       = EXCLUDED.debt,
  bfr        = EXCLUDED.bfr,
  source     = EXCLUDED.source,
  source_file= EXCLUDED.source_file,
  updated_at = now();
