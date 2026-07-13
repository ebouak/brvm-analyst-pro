-- 0095 — Santé des tâches planifiées (pg_cron) exposée au poste de pilotage.
--
-- POURQUOI : /admin/scraping lit `scraper_runs`, alimentée par les workers
-- GitHub Actions. Les tâches pg_cron, elles, n'écrivent nulle part que nous
-- lisions. Résultat : `trigger-github-workflow-15min` a échoué 672 fois en une
-- semaine — toutes les 15 minutes, 24 h/24 — sans qu'aucun écran ne le montre.
-- Un monitoring qui ne couvre qu'une moitié du système donne surtout l'illusion
-- d'être surveillé.
--
-- Le schéma `cron` n'est pas exposé par PostgREST : on passe donc par une
-- fonction SECURITY DEFINER dans `public`, révoquée pour tout le monde sauf le
-- service_role (les pages admin l'appellent côté serveur).

create or replace function public.get_cron_health()
returns table (
  jobname       text,
  schedule      text,
  active        boolean,
  runs_24h      bigint,
  failures_24h  bigint,
  last_status   text,
  last_run      timestamptz,
  last_error    text
)
language sql
stable
security definer
set search_path to 'cron', 'public', 'pg_temp'
as $$
  select
    j.jobname::text,
    j.schedule::text,
    j.active,
    count(d.runid) filter (where d.start_time > now() - interval '24 hours')                        as runs_24h,
    count(d.runid) filter (where d.start_time > now() - interval '24 hours' and d.status = 'failed') as failures_24h,
    -- Statut et message de la DERNIÈRE exécution : c'est l'état courant qui
    -- décide s'il faut agir, pas la moyenne des sept derniers jours.
    (array_agg(d.status      order by d.start_time desc))[1]::text as last_status,
    (array_agg(d.end_time    order by d.start_time desc))[1]       as last_run,
    (array_agg(
        case when d.status = 'failed' then left(d.return_message, 300) end
        order by d.start_time desc
     ) filter (where d.status = 'failed'))[1]::text                as last_error
  from cron.job j
  left join cron.job_run_details d on d.jobid = j.jobid
  group by j.jobname, j.schedule, j.active
  order by j.jobname;
$$;

-- Les TROIS rôles : révoquer PUBLIC seul ne retire pas les grants nominatifs que
-- Supabase accorde par défaut à anon/authenticated (cf. 0093 — l'erreur qui avait
-- laissé purge_auth_events() appelable en curl anonyme).
revoke execute on function public.get_cron_health() from public, anon, authenticated;
