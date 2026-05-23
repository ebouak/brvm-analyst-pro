-- ============================================================================
-- BRVM Analyst Pro — Vues matérialisées (cf. §8)
-- À rafraîchir après chaque run de scraping (voir 0004_cron.sql).
-- ============================================================================

-- Volume moyen 30 jours par titre (sert au volume_ratio du scoring §9).
drop materialized view if exists public.mv_volume_avg_30d;
create materialized view public.mv_volume_avg_30d as
select
  code,
  avg(volume)::numeric(20,2)               as avg_volume_30d,
  stddev_pop(volume)::numeric(20,2)        as std_volume_30d,
  count(*)                                  as nb_jours
from public.brvm_actions_daily
where date_marche >= current_date - interval '30 days'
  and volume is not null
group by code;
create unique index if not exists idx_mv_volume_avg_30d on public.mv_volume_avg_30d (code);

-- Métriques de rendement (variation, perf glissantes) — dernière séance.
drop materialized view if exists public.mv_returns_metrics;
create materialized view public.mv_returns_metrics as
with last_day as (
  select max(date_marche) as d from public.brvm_actions_daily
)
select
  a.code,
  a.date_marche,
  a.cours_jour,
  a.variation_pct,
  (a.cours_jour - lag(a.cours_jour, 5)  over w) / nullif(lag(a.cours_jour, 5)  over w, 0) * 100 as ret_5j,
  (a.cours_jour - lag(a.cours_jour, 21) over w) / nullif(lag(a.cours_jour, 21) over w, 0) * 100 as ret_1m
from public.brvm_actions_daily a
window w as (partition by a.code order by a.date_marche)
;
create index if not exists idx_mv_returns_code on public.mv_returns_metrics (code, date_marche desc);

-- Snapshot du dernier marché disponible (dashboard §5.1).
drop materialized view if exists public.mv_latest_market_snapshot;
create materialized view public.mv_latest_market_snapshot as
with last_day as (
  select max(date_marche) as d from public.brvm_actions_daily
)
select a.*
from public.brvm_actions_daily a, last_day
where a.date_marche = last_day.d;
create unique index if not exists idx_mv_latest_code on public.mv_latest_market_snapshot (code);

-- Entrées de calcul des signaux (jointure cotation + volume moyen).
drop materialized view if exists public.mv_signal_inputs;
create materialized view public.mv_signal_inputs as
with last_day as (
  select max(date_marche) as d from public.brvm_actions_daily
)
select
  a.code,
  a.date_marche,
  a.cours_jour,
  a.variation_pct,
  a.volume,
  v.avg_volume_30d,
  case when v.avg_volume_30d > 0
       then a.volume::numeric / v.avg_volume_30d
       else null end as volume_ratio
from public.brvm_actions_daily a
join last_day on a.date_marche = last_day.d
left join public.mv_volume_avg_30d v on v.code = a.code;
create unique index if not exists idx_mv_signal_inputs_code on public.mv_signal_inputs (code);

-- Fonction utilitaire pour tout rafraîchir (appelée par le cron / le scraper).
create or replace function public.refresh_market_views()
returns void language plpgsql as $$
begin
  refresh materialized view concurrently public.mv_volume_avg_30d;
  refresh materialized view public.mv_returns_metrics;
  refresh materialized view concurrently public.mv_latest_market_snapshot;
  refresh materialized view concurrently public.mv_signal_inputs;
end; $$;
