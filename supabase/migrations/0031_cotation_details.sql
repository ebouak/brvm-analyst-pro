-- supabase/migrations/0031_cotation_details.sql
-- Détail de cotation par instrument (façon Sika Finance) : OHLC intraday,
-- beta, capitalisation. Sources : pages /marches/cotation_<symbol> de Sika
-- Finance (le scraper peut lire l'externe ; le frontend reste Supabase-only).
-- Idempotent.

alter table public.brvm_actions_daily
  add column if not exists ouverture     numeric, -- cours d'ouverture séance
  add column if not exists plus_haut      numeric, -- plus haut intraday
  add column if not exists plus_bas       numeric, -- plus bas intraday
  add column if not exists beta_1an       numeric, -- beta 1 an (vs marché)
  add column if not exists valorisation   numeric; -- capitalisation boursière (XOF)

-- valeur_echangee (capital échangé en XOF) existe déjà depuis 0001.

comment on column public.brvm_actions_daily.ouverture   is 'Cours d''ouverture de la séance (Sika Finance)';
comment on column public.brvm_actions_daily.plus_haut    is 'Plus haut intraday (Sika Finance)';
comment on column public.brvm_actions_daily.plus_bas     is 'Plus bas intraday (Sika Finance)';
comment on column public.brvm_actions_daily.beta_1an     is 'Beta 1 an vs marché (Sika Finance)';
comment on column public.brvm_actions_daily.valorisation is 'Capitalisation boursière en XOF (Sika Finance)';
