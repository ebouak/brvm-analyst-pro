-- 0139 — La fourchette retenue par le moteur de liquidité, et sa provenance.
--
-- Jusqu'ici `liquidity_daily.spread_roll_pct` portait une ESTIMATION (Roll),
-- absente ~40 % du temps. Le Bulletin Officiel de la Cote publie désormais les
-- meilleures limites des deux côtés : la fourchette devient MESURABLE.
--
-- On garde les deux, séparément, et on dit laquelle a servi. Écraser la colonne
-- de Roll aurait effacé la seule façon de comparer l'estimation au fait.

alter table public.liquidity_daily
  add column if not exists spread_pct numeric,
  add column if not exists spread_source text;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.liquidity_daily'::regclass
                   and conname = 'liquidity_daily_spread_source_check') then
    alter table public.liquidity_daily
      add constraint liquidity_daily_spread_source_check
      check (spread_source is null or spread_source in ('carnet', 'roll'));
  end if;
end $$;

comment on column public.liquidity_daily.spread_pct is
  'Fourchette retenue pour le score, en % du cours.';
comment on column public.liquidity_daily.spread_source is
  'carnet = mesurée sur les limites publiées par la BRVM ; roll = estimée statistiquement. Un lecteur doit pouvoir distinguer un fait d''une estimation.';
