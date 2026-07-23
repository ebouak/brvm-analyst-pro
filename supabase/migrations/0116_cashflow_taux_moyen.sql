-- 0116 — Repasse la conversion ETIT du taux de CLÔTURE au taux MOYEN d'exercice.
--
-- POURQUOI
-- IAS 21 convertit les flux de trésorerie et le compte de résultat au taux MOYEN
-- de la période (le taux de clôture ne sert qu'aux postes de bilan). La migration
-- 0115 avait appliqué le taux de clôture ; c'est corrigé ici.
--
-- Ce n'est pas qu'une question de doctrine : les taux moyens calculés sur les
-- cotations quotidiennes BCE coïncident avec les taux IMPLICITES d'ETI, obtenus
-- en divisant le résultat net FCFA d'income_statements par le résultat net USD
-- du tableau de flux. ETI a donc bien converti au taux moyen, et n'utiliser que
-- lui fait RÉCONCILIER les deux tables — ce que le taux de clôture empêchait.
--
--   exercice | USD/XOF moyen (BCE) | taux implicite ETI | clôture (rejeté)
--   2022     | 624,148             | 623,8              | 615,011
--   2023     | 606,827             | 606,5              | 593,626
--   2024     | 606,139             | 607,2              | 631,396
--   2025     | 581,834             | 581,6              | 558,261
--
-- Moyenne calculée comme moyenne des taux USD/XOF quotidiens — soit
-- moyenne(655,957 / (EUR/USD)_j) — et NON 655,957 / moyenne(EUR/USD) : l'inverse
-- d'une moyenne n'est pas la moyenne des inverses (écart de 1,4 FCFA en 2022).
--
-- IDEMPOTENCE / REJOUABILITÉ
-- Le rescaling ne cible que les lignes portant encore le taux de clôture exact.
-- Sur une base neuve, 0115 (corrigée depuis pour appliquer directement le taux
-- moyen) laisse taux_conversion au moyen : cette migration ne matche alors rien.

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('2022', 615.011::numeric, 624.148::numeric),
      ('2023', 593.626::numeric, 606.827::numeric),
      ('2024', 631.396::numeric, 606.139::numeric),
      ('2025', 558.261::numeric, 581.834::numeric)
    ) as v(periode, taux_cloture, taux_moyen)
  loop
    update public.cash_flow_statements set
      flux_exploitation               = round(flux_exploitation               / t.taux_cloture * t.taux_moyen),
      resultat_net                    = round(resultat_net                    / t.taux_cloture * t.taux_moyen),
      depreciation_amortissement      = round(depreciation_amortissement      / t.taux_cloture * t.taux_moyen),
      impots_reportes                 = round(impots_reportes                 / t.taux_cloture * t.taux_moyen),
      remuneration_actions            = round(remuneration_actions            / t.taux_cloture * t.taux_moyen),
      variation_bfr                   = round(variation_bfr                   / t.taux_cloture * t.taux_moyen),
      autres_elements_hors_caisse     = round(autres_elements_hors_caisse     / t.taux_cloture * t.taux_moyen),
      flux_investissement             = round(flux_investissement             / t.taux_cloture * t.taux_moyen),
      investissements_ppe             = round(investissements_ppe             / t.taux_cloture * t.taux_moyen),
      acquisitions                    = round(acquisitions                    / t.taux_cloture * t.taux_moyen),
      achats_placements               = round(achats_placements               / t.taux_cloture * t.taux_moyen),
      ventes_placements               = round(ventes_placements               / t.taux_cloture * t.taux_moyen),
      autres_activites_investissement = round(autres_activites_investissement / t.taux_cloture * t.taux_moyen),
      flux_financement                = round(flux_financement                / t.taux_cloture * t.taux_moyen),
      remboursement_dette             = round(remboursement_dette             / t.taux_cloture * t.taux_moyen),
      dividendes_verses               = round(dividendes_verses               / t.taux_cloture * t.taux_moyen),
      rachats_actions                 = round(rachats_actions                 / t.taux_cloture * t.taux_moyen),
      emissions_actions               = round(emissions_actions               / t.taux_cloture * t.taux_moyen),
      autres_activites_financement    = round(autres_activites_financement    / t.taux_cloture * t.taux_moyen),
      effet_forex_tresorerie          = round(effet_forex_tresorerie          / t.taux_cloture * t.taux_moyen),
      variation_tresorerie            = round(variation_tresorerie            / t.taux_cloture * t.taux_moyen),
      tresorerie_debut_periode        = round(tresorerie_debut_periode        / t.taux_cloture * t.taux_moyen),
      tresorerie_fin_periode          = round(tresorerie_fin_periode          / t.taux_cloture * t.taux_moyen),
      depenses_capital                = round(depenses_capital                / t.taux_cloture * t.taux_moyen),
      flux_tresorerie_disponible      = round(flux_tresorerie_disponible      / t.taux_cloture * t.taux_moyen),
      taux_conversion                 = t.taux_moyen,
      date_taux                       = null      -- taux de période, pas de date unique
    where code = 'ETIT'
      and periode = t.periode
      and devise_origine = 'USD'
      and taux_conversion = t.taux_cloture;       -- garde-fou : ne rescale qu'une fois
  end loop;
end $$;

comment on column public.cash_flow_statements.taux_conversion is
  'Taux MOYEN de l''exercice appliqué pour convertir en FCFA (1 unité de devise_origine = N FCFA), conformément à IAS 21. NULL si aucune conversion.';
comment on column public.cash_flow_statements.date_taux is
  'Date du taux ponctuel utilisé. NULL quand taux_conversion est un taux moyen de période.';
