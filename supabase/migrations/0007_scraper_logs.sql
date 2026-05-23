-- ============================================================================
-- BRVM Analyst Pro — Migration 0007 : table scraper_logs
--
-- Journal structuré des runs de chaque Edge Function / worker cron.
-- Plus granulaire que scrape_runs (qui est lié au scraping de séance) :
-- scraper_logs couvre aussi les workers score, events, dividends, alerts.
--
-- RLS : lecture authentifiée, écriture réservée au service_role.
-- ============================================================================

create table if not exists public.scraper_logs (
  id               uuid        default gen_random_uuid() primary key,
  run_at           timestamptz default now() not null,
  -- Nom du worker ou de la Edge Function (ex: 'scrape-daily', 'score-daily').
  function_name    text        not null,
  -- Statut de fin d'exécution.
  status           text        not null check (status in ('success', 'error', 'partial')),
  -- Nombre de lignes insérées (nouvelles).
  rows_inserted    int         not null default 0,
  -- Nombre de lignes mises à jour (upsert sur existant).
  rows_updated     int         not null default 0,
  -- Durée d'exécution en millisecondes (null si non mesuré).
  duration_ms      int,
  -- Date de marché ciblée (null pour les workers sans date précise).
  date_marche      date,
  -- Message d'erreur si status = 'error' ou 'partial'.
  error_message    text,
  -- Métadonnées libres (JSON) pour infos complémentaires.
  meta             jsonb
);

-- Index pour les requêtes de monitoring les plus fréquentes.
create index if not exists scraper_logs_run_at_idx
  on public.scraper_logs (run_at desc);

create index if not exists scraper_logs_function_status_idx
  on public.scraper_logs (function_name, status, run_at desc);

-- RLS : lecture pour les utilisateurs authentifiés (monitoring dashboard).
-- Écriture uniquement via service_role (bypass RLS — scraper backend).
alter table public.scraper_logs enable row level security;

create policy "lecture authentifiee scraper_logs"
  on public.scraper_logs
  for select
  to authenticated
  using (true);

-- ============================================================================
-- Vues utilitaires pour le monitoring (cf. docs/DEPLOYMENT.md §5)
-- ============================================================================

-- Dernier run par function, tous statuts confondus.
create or replace view public.v_scraper_last_runs as
select distinct on (function_name)
  id,
  function_name,
  status,
  run_at,
  rows_inserted,
  rows_updated,
  duration_ms,
  date_marche,
  error_message
from public.scraper_logs
order by function_name, run_at desc;

comment on view public.v_scraper_last_runs is
  'Dernier run de chaque worker/Edge Function — utile pour le monitoring.';

-- Alerte : workers silencieux depuis plus de 30h (hors week-end).
create or replace view public.v_scraper_stale as
select
  function_name,
  max(run_at) as last_run_at,
  extract(epoch from (now() - max(run_at))) / 3600 as hours_since_last_run
from public.scraper_logs
where status = 'success'
group by function_name
having max(run_at) < now() - interval '30 hours';

comment on view public.v_scraper_stale is
  'Workers sans run réussi depuis plus de 30h — déclenche une alerte.';
