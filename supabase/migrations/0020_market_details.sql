-- Champs de cotation détaillés (source : richbourse.com/common/mouvements)
alter table public.brvm_actions_daily
  add column if not exists ouverture  numeric(12,2),
  add column if not exists plus_haut  numeric(12,2),
  add column if not exists plus_bas   numeric(12,2);

-- Données société complémentaires
alter table public.brvm_instruments
  add column if not exists flottant      bigint,
  add column if not exists vol_moyen_30j integer;

comment on column public.brvm_actions_daily.ouverture    is 'Cours d''ouverture de séance (source richbourse)';
comment on column public.brvm_actions_daily.plus_haut    is 'Plus haut intraday (source richbourse)';
comment on column public.brvm_actions_daily.plus_bas     is 'Plus bas intraday (source richbourse)';
comment on column public.brvm_instruments.flottant       is 'Titres du flottant (source richbourse)';
comment on column public.brvm_instruments.vol_moyen_30j  is 'Volume moyen 30 jours (source richbourse)';
