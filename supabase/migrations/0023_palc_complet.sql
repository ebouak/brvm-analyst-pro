-- ============================================================
-- PALMCI (PALC) — Données complètes 2025 & 2024
-- Source JSON vérifié par l'utilisateur (PDF états financiers 31/12/2025)
-- Unité source : milliers FCFA → stockage en FCFA (× 1 000)
-- actions_en_circulation réel : 20 406 297 (capital 20,4 Md / nominal 1 000 FCFA)
-- ============================================================

-- ── Instruments ──────────────────────────────────────────────
UPDATE public.brvm_instruments SET
  shares        = 20406297,
  shares_source = 'états financiers 2025 (capital 20 406 297 kFCFA / nominal 1 000 FCFA)'
WHERE code = 'PALC';

-- ── Compte de résultat ───────────────────────────────────────
INSERT INTO public.income_statements (
  code, periode, type_periode,
  revenu_total,
  cout_ventes,
  marge_brute,
  frais_generaux_admin,
  depenses_rd,
  autres_depenses,
  resultat_exploitation,
  charges_financieres_nettes,
  resultat_avant_impots,
  impots,
  resultat_net,
  benefice_par_action,
  benefice_par_action_dilue,
  dividende_par_action,
  actions_en_circulation
) VALUES
-- 2025 (valeurs × 1 000 car source en milliers FCFA)
-- depenses_rd = charges de personnel (59 747 530 kFCFA réalloué)
-- autres_depenses = autres charges opérationnelles
('PALC','2025','annuel',
  197629996000, 110612438000, 87017558000,
  30126881000, 29620649000,
  44484941000,  18163004000,
  -2213587000,  20220189000,
  -4711534000,  15508655000,
  760.00, 760.00, 502.00, 20406297),
-- 2024
('PALC','2024','annuel',
  172182502000, 91409620000, 80772882000,
  18517778000, 28484146000,
  46206242000,  19393765000,
  -2530871000,  22119343000,
  -6257700000,  15861643000,
  777.00, 777.00, 389.00, 20406297)
ON CONFLICT (code, periode, type_periode) DO UPDATE SET
  revenu_total              = EXCLUDED.revenu_total,
  cout_ventes               = EXCLUDED.cout_ventes,
  marge_brute               = EXCLUDED.marge_brute,
  frais_generaux_admin      = EXCLUDED.frais_generaux_admin,
  depenses_rd               = EXCLUDED.depenses_rd,
  autres_depenses           = EXCLUDED.autres_depenses,
  resultat_exploitation     = EXCLUDED.resultat_exploitation,
  charges_financieres_nettes= EXCLUDED.charges_financieres_nettes,
  resultat_avant_impots     = EXCLUDED.resultat_avant_impots,
  impots                    = EXCLUDED.impots,
  resultat_net              = EXCLUDED.resultat_net,
  benefice_par_action       = EXCLUDED.benefice_par_action,
  benefice_par_action_dilue = EXCLUDED.benefice_par_action_dilue,
  dividende_par_action      = EXCLUDED.dividende_par_action,
  actions_en_circulation    = EXCLUDED.actions_en_circulation;

-- ── Bilan ────────────────────────────────────────────────────
INSERT INTO public.balance_sheets (
  code, periode, type_periode,
  total_actifs,
  total_actif_circulant,
  tresorerie_equivalents,
  investissements_court_terme,
  creances_clients,
  stocks,
  autres_actifs_courants,
  total_actif_non_courant,
  immobilisations_nettes,
  goodwill,
  actifs_incorporels,
  investissements_long_terme,
  total_passif,
  passif_courant,
  fournisseurs,
  dette_court_terme,
  autres_passifs_courants,
  passif_non_courant,
  dette_long_terme,
  total_capitaux_propres,
  capital_social,
  reserves_benefices_non_repartis
) VALUES
-- 2025
('PALC','2025','annuel',
  199116293000, 86256798000,
  9488637000, 0, 78270148000, 7986650000, 0,
  103370859000, 99076870000, 0, 184157000, 3085720000,
  199116293000,
  55680750000, 41633570000, 14047180000, 0,
  796559000, 796559000,
  142638984000, 20406297000,
  106724033000),   -- primes+réserves+report : 40 451 282 + 66 272 751
-- 2024
('PALC','2024','annuel',
  202603319000, 93705506000,
  9362246000, 0, 82699056000, 11006450000, 0,
  99535567000, 96310107000, 0, 255203000, 2961386000,
  202603319000,
  63495139000, 41473506000, 22021633000, 0,
  4047029000, 4047029000,
  135061151000, 20406297000,
  98793211000)    -- 40 451 282 + 58 341 929
ON CONFLICT (code, periode, type_periode) DO UPDATE SET
  total_actifs                    = EXCLUDED.total_actifs,
  total_actif_circulant           = EXCLUDED.total_actif_circulant,
  tresorerie_equivalents          = EXCLUDED.tresorerie_equivalents,
  investissements_court_terme     = EXCLUDED.investissements_court_terme,
  creances_clients                = EXCLUDED.creances_clients,
  stocks                          = EXCLUDED.stocks,
  autres_actifs_courants          = EXCLUDED.autres_actifs_courants,
  total_actif_non_courant         = EXCLUDED.total_actif_non_courant,
  immobilisations_nettes          = EXCLUDED.immobilisations_nettes,
  goodwill                        = EXCLUDED.goodwill,
  actifs_incorporels              = EXCLUDED.actifs_incorporels,
  investissements_long_terme      = EXCLUDED.investissements_long_terme,
  total_passif                    = EXCLUDED.total_passif,
  passif_courant                  = EXCLUDED.passif_courant,
  fournisseurs                    = EXCLUDED.fournisseurs,
  dette_court_terme               = EXCLUDED.dette_court_terme,
  autres_passifs_courants         = EXCLUDED.autres_passifs_courants,
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
  acquisitions,
  flux_financement,
  dividendes_verses,
  remboursement_dette,
  emissions_actions,
  variation_tresorerie,
  tresorerie_debut_periode,
  tresorerie_fin_periode,
  depenses_capital,
  flux_tresorerie_disponible
) VALUES
-- 2025
('PALC','2025','annuel',
  38740600000, 15508655000, 19109395000, 8174151000,
  -19687331000, -19502640000, -164345000,
  -10952426000, -7930821000, -3021604000, 0,
  8100843000, -12659387000, -4558544000,
  -19502640000,
  19237960000),  -- FCF = flux_op - capex
-- 2024
('PALC','2024','annuel',
  28463195000, 15861643000, 18179127000, -4839960000,
  -19822162000, -20003550000, -56641000,
  -13067785000, -9675923000, -3402158000, 10295000,
  -4426752000, -8232635000, -12659387000,
  -20003550000,
  8459645000)
ON CONFLICT (code, periode, type_periode) DO UPDATE SET
  flux_exploitation          = EXCLUDED.flux_exploitation,
  resultat_net               = EXCLUDED.resultat_net,
  depreciation_amortissement = EXCLUDED.depreciation_amortissement,
  variation_bfr              = EXCLUDED.variation_bfr,
  flux_investissement        = EXCLUDED.flux_investissement,
  investissements_ppe        = EXCLUDED.investissements_ppe,
  acquisitions               = EXCLUDED.acquisitions,
  flux_financement           = EXCLUDED.flux_financement,
  dividendes_verses          = EXCLUDED.dividendes_verses,
  remboursement_dette        = EXCLUDED.remboursement_dette,
  emissions_actions          = EXCLUDED.emissions_actions,
  variation_tresorerie       = EXCLUDED.variation_tresorerie,
  tresorerie_debut_periode   = EXCLUDED.tresorerie_debut_periode,
  tresorerie_fin_periode     = EXCLUDED.tresorerie_fin_periode,
  depenses_capital           = EXCLUDED.depenses_capital,
  flux_tresorerie_disponible = EXCLUDED.flux_tresorerie_disponible;

-- ── Fundamentals (résumé ratios) ─────────────────────────────
INSERT INTO public.fundamentals (code, year, revenue, net_income, equity, cash, debt, bfr, source, source_file)
VALUES
  ('PALC', 2025,
    197629996000, 15508655000, 142638984000,
    9488637000,
    796559000,           -- dettes financières LT uniquement (CT = trésorerie passif bancaire)
    44623228000,         -- BFR = actif circulant (86 256 798) - passif circulant (41 633 570)
    'pdf-verified', '20260323-etats-financiers-2025-palm-ci.pdf'),
  ('PALC', 2024,
    172182502000, 15861643000, 135061151000,
    9362246000,
    4047029000,
    30210367000,         -- BFR = 93 705 506 - 63 495 139
    'pdf-verified', '20260323-etats-financiers-2025-palm-ci.pdf')
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
