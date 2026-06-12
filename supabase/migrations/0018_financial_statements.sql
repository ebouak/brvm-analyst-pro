-- 52 semaines sur brvm_actions_daily (colonnes optionnelles)
alter table public.brvm_actions_daily
  add column if not exists cours_bas_52s  numeric(18,4),
  add column if not exists cours_haut_52s numeric(18,4);

-- Compte de résultat détaillé
create table if not exists public.income_statements (
  id                          uuid primary key default gen_random_uuid(),
  code                        text not null references public.brvm_instruments(code) on update cascade,
  periode                     varchar(10) not null,
  type_periode                varchar(10) not null default 'annuel',
  revenu_total                bigint,
  cout_ventes                 bigint,
  marge_brute                 bigint,
  depenses_exploitation       bigint,
  frais_generaux_admin        bigint,
  depenses_rd                 bigint,
  autres_depenses             bigint,
  resultat_exploitation       bigint,
  charges_financieres_nettes  bigint,
  resultat_avant_impots       bigint,
  impots                      bigint,
  resultat_net                bigint,
  benefice_par_action         numeric(12,2),
  benefice_par_action_dilue   numeric(12,2),
  actions_en_circulation      bigint,
  actions_diluees             bigint,
  dividende_par_action        numeric(12,2),
  created_at                  timestamptz not null default now(),
  unique (code, periode, type_periode)
);

create index if not exists idx_income_code_periode
  on public.income_statements (code, type_periode, periode desc);

-- Bilan détaillé
create table if not exists public.balance_sheets (
  id                              uuid primary key default gen_random_uuid(),
  code                            text not null references public.brvm_instruments(code) on update cascade,
  periode                         varchar(10) not null,
  type_periode                    varchar(10) not null default 'annuel',
  total_actifs                    bigint,
  total_actif_circulant           bigint,
  tresorerie_equivalents          bigint,
  investissements_court_terme     bigint,
  creances_clients                bigint,
  stocks                          bigint,
  autres_actifs_courants          bigint,
  total_actif_non_courant         bigint,
  immobilisations_nettes          bigint,
  goodwill                        bigint,
  actifs_incorporels              bigint,
  investissements_long_terme      bigint,
  autres_actifs_financiers        bigint,
  total_passif                    bigint,
  passif_courant                  bigint,
  fournisseurs                    bigint,
  dette_court_terme               bigint,
  revenus_differes_courants       bigint,
  autres_passifs_courants         bigint,
  passif_non_courant              bigint,
  dette_long_terme                bigint,
  autres_passifs_non_courants     bigint,
  impots_differes_passifs         bigint,
  total_capitaux_propres          bigint,
  capital_social                  bigint,
  reserves_benefices_non_repartis bigint,
  autres_capitaux_propres         bigint,
  interets_minoritaires           bigint,
  created_at                      timestamptz not null default now(),
  unique (code, periode, type_periode)
);

create index if not exists idx_balance_code_periode
  on public.balance_sheets (code, type_periode, periode desc);

-- Flux de trésorerie
create table if not exists public.cash_flow_statements (
  id                              uuid primary key default gen_random_uuid(),
  code                            text not null references public.brvm_instruments(code) on update cascade,
  periode                         varchar(10) not null,
  type_periode                    varchar(10) not null default 'annuel',
  flux_exploitation               bigint,
  resultat_net                    bigint,
  depreciation_amortissement      bigint,
  impots_reportes                 bigint,
  remuneration_actions            bigint,
  variation_bfr                   bigint,
  autres_elements_hors_caisse     bigint,
  flux_investissement             bigint,
  investissements_ppe             bigint,
  acquisitions                    bigint,
  achats_placements               bigint,
  ventes_placements               bigint,
  autres_activites_investissement bigint,
  flux_financement                bigint,
  remboursement_dette             bigint,
  dividendes_verses               bigint,
  rachats_actions                 bigint,
  emissions_actions               bigint,
  autres_activites_financement    bigint,
  effet_forex_tresorerie          bigint,
  variation_tresorerie            bigint,
  tresorerie_debut_periode        bigint,
  tresorerie_fin_periode          bigint,
  depenses_capital                bigint,
  flux_tresorerie_disponible      bigint,
  created_at                      timestamptz not null default now(),
  unique (code, periode, type_periode)
);

create index if not exists idx_cashflow_code_periode
  on public.cash_flow_statements (code, type_periode, periode desc);

-- RLS lecture publique
alter table public.income_statements    enable row level security;
alter table public.balance_sheets       enable row level security;
alter table public.cash_flow_statements enable row level security;

-- Drop policies if they exist (idempotence for re-application)
drop policy if exists "lecture publique income_statements"    on public.income_statements;
drop policy if exists "lecture publique balance_sheets"       on public.balance_sheets;
drop policy if exists "lecture publique cash_flow_statements" on public.cash_flow_statements;

-- Create policies
create policy "lecture publique income_statements"    on public.income_statements    for select using (true);
create policy "lecture publique balance_sheets"       on public.balance_sheets       for select using (true);
create policy "lecture publique cash_flow_statements" on public.cash_flow_statements for select using (true);
