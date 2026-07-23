-- 0115 — Traçabilité de conversion de devise sur les flux de trésorerie,
--        et conversion des lignes ETIT libellées en dollars.
--
-- CONTEXTE
-- Ecobank Transnational (ETIT) publie ses états consolidés en USD. Le compte de
-- résultat et le bilan avaient été convertis en FCFA à l'extraction, mais PAS le
-- tableau de flux de trésorerie : cash_flow_statements contenait des dollars
-- présentés comme des francs, soit des montants ~580 à 620 fois trop faibles
-- (flux d'exploitation 2025 affiché à 1,17 Md FCFA au lieu de ~655 Md).
--
-- Vérifié sur trois sources concordantes : publication ETI (profit après impôt
-- 2025 = 594,1 M USD), Sika Finance (résultat net 2023 = 246,81 Md FCFA) et
-- notre propre income_statements. Seuls les flux étaient en cause.
--
-- MÉTHODE
-- Conversion au taux MOYEN de l'exercice (IAS 21 : les flux de trésorerie et le
-- compte de résultat se convertissent au taux moyen ; le taux de clôture ne sert
-- qu'aux postes de bilan). Le taux moyen est la moyenne des taux USD/XOF
-- quotidiens sur les ~257 cotations BCE de l'année, chacun valant
-- 655,957 / (EUR/USD) du jour — le XOF étant fixe à l'euro depuis 1999.
--
--   exercice | USD/XOF moyen | taux implicite ETI (contrôle)
--   2022     | 624,148       | 623,8
--   2023     | 606,827       | 606,5
--   2024     | 606,139       | 607,2
--   2025     | 581,834       | 581,6
--
-- Le taux implicite est obtenu en divisant le résultat net FCFA d'income_statements
-- par le résultat net USD du tableau de flux : il reconstitue le taux qu'ETI a
-- réellement employé. Sa coïncidence avec le taux moyen BCE confirme la méthode,
-- et la conversion fait retomber les deux tables l'une sur l'autre à 0,2 % près.
--
-- La provenance reste stockée (devise d'origine, taux appliqué) et l'interface
-- l'affiche : aucun chiffre converti n'est présenté comme une donnée publiée.
--
-- Idempotence : la conversion ne s'applique qu'aux lignes dont devise_origine
-- est NULL. Rejouer la migration ne double-convertit rien.

alter table public.cash_flow_statements
  add column if not exists devise_origine   text,
  add column if not exists taux_conversion  numeric,
  add column if not exists date_taux        date;

comment on column public.cash_flow_statements.devise_origine is
  'Devise du document source quand elle n''est pas le FCFA (ex. ''USD'' pour ETI). NULL = montants déjà en FCFA à la source.';
comment on column public.cash_flow_statements.taux_conversion is
  'Taux appliqué pour convertir en FCFA (1 unité de devise_origine = N FCFA). NULL si aucune conversion.';
comment on column public.cash_flow_statements.date_taux is
  'Date du taux de référence utilisé (clôture d''exercice).';

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('2022', 624.148::numeric, null::date),
      ('2023', 606.827::numeric, null::date),
      ('2024', 606.139::numeric, null::date),
      ('2025', 581.834::numeric, null::date)
    ) as v(periode, taux, d)
  loop
    update public.cash_flow_statements set
      flux_exploitation               = round(flux_exploitation               * t.taux),
      resultat_net                    = round(resultat_net                    * t.taux),
      depreciation_amortissement      = round(depreciation_amortissement      * t.taux),
      impots_reportes                 = round(impots_reportes                 * t.taux),
      remuneration_actions            = round(remuneration_actions            * t.taux),
      variation_bfr                   = round(variation_bfr                   * t.taux),
      autres_elements_hors_caisse     = round(autres_elements_hors_caisse     * t.taux),
      flux_investissement             = round(flux_investissement             * t.taux),
      investissements_ppe             = round(investissements_ppe             * t.taux),
      acquisitions                    = round(acquisitions                    * t.taux),
      achats_placements               = round(achats_placements               * t.taux),
      ventes_placements               = round(ventes_placements               * t.taux),
      autres_activites_investissement = round(autres_activites_investissement * t.taux),
      flux_financement                = round(flux_financement                * t.taux),
      remboursement_dette             = round(remboursement_dette             * t.taux),
      dividendes_verses               = round(dividendes_verses               * t.taux),
      rachats_actions                 = round(rachats_actions                 * t.taux),
      emissions_actions               = round(emissions_actions               * t.taux),
      autres_activites_financement    = round(autres_activites_financement    * t.taux),
      effet_forex_tresorerie          = round(effet_forex_tresorerie          * t.taux),
      variation_tresorerie            = round(variation_tresorerie            * t.taux),
      tresorerie_debut_periode        = round(tresorerie_debut_periode        * t.taux),
      tresorerie_fin_periode          = round(tresorerie_fin_periode          * t.taux),
      depenses_capital                = round(depenses_capital                * t.taux),
      flux_tresorerie_disponible      = round(flux_tresorerie_disponible      * t.taux),
      devise_origine                  = 'USD',
      taux_conversion                 = t.taux,
      date_taux                       = t.d
    where code = 'ETIT'
      and periode = t.periode
      and devise_origine is null;   -- garde-fou d'idempotence
  end loop;
end $$;
