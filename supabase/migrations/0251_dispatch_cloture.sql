-- ============================================================================
-- 0251 — Déclencher la consolidation de clôture dès 15:20 UTC (option C).
--
-- POURQUOI. La vidéo de séance, la Chaîne WhatsApp, le canal Telegram et les
-- points de clôture privés ne doivent partir que sur des chiffres DÉFINITIFS.
-- La preuve en est un run réussi de la commande `daily` (workflow `bdfin.yml`,
-- source BDFIN) pour la séance du jour. Or ce workflow est planifié à 16:30
-- UTC et GitHub le fait partir entre 21:50 et 23:00 (mesuré du 10 au
-- 19/11/2026) : la publication attendait donc la nuit.
--
-- On réutilise le mécanisme de l'intraday (0040) : pg_cron appelle l'API
-- GitHub `workflow_dispatch` avec le PAT du Vault (`github_pat_brvm`). La
-- cible est `bdfin.yml` et NON `scrape-daily.yml` : ce dernier lance
-- `npm run intraday` (source `intraday`), jamais la commande `daily`, et il
-- enchaîne l'envoi des alertes — le déclencher quatre fois par séance aurait
-- réévalué les alertes quatre fois sans jamais produire la preuve attendue.
--
-- Quatre passages, 15:20, 15:50, 16:30 et 17:30 UTC les jours ouvrés. Chaque
-- passage s'arrête de lui-même si la clôture est déjà confirmée : BDFIN met à
-- jour sa séance à une heure variable, un passage trop tôt relit la veille
-- (metadata.date_marche ≠ aujourd'hui) et ne prouve rien, le suivant réessaie.
-- Le cron GitHub de bdfin.yml (16:30) reste en place comme filet.
--
-- Règle de confirmation (même règle que video/cloture.mjs et
-- scraper/src/cloture/confirmation.ts, à tenir des trois côtés) :
--   scraper_sources.code = 'daily', scraper_runs.status = 'success',
--   metadata->>'date_marche' = la séance, finished_at >= séance 15:00 UTC,
--   metadata->>'nb_actions' >= 20.
-- `scraper_runs` n'a pas de colonne de séance : elle n'existe que dans
-- `metadata`, écrite par le CLI `daily` (scraper/src/index.ts).
--
-- Sécurité : fonctions SECURITY DEFINER (lecture du Vault et de scraper_runs,
-- sous RLS sans policy), search_path fixé, EXECUTE révoqué à public, anon ET
-- authenticated (voir CLAUDE.md §11 : `from public` seul ne suffit pas).
-- Seul pg_cron (rôle postgres) les appelle.
--
-- Prérequis : pg_cron, pg_net et le secret Vault `github_pat_brvm` (0040),
-- déjà en place. Le PAT doit pouvoir dispatcher `bdfin.yml` (même dépôt, même
-- permission « Actions : Read and write » que pour intraday.yml).
-- À APPLIQUER par l'exploitant — non appliquée par la PR qui l'introduit.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 1. La règle, en SQL ─────────────────────────────────────────────────────
create or replace function public.cloture_confirmee(p_seance date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.scraper_runs r
    join public.scraper_sources s on s.id = r.source_id
    where s.code = 'daily'
      and r.status = 'success'
      and r.started_at >= p_seance::timestamp at time zone 'UTC'
      and r.finished_at >= (p_seance::timestamp + interval '15 hours') at time zone 'UTC'
      and r.metadata->>'date_marche' = to_char(p_seance, 'YYYY-MM-DD')
      and coalesce(r.metadata->>'nb_actions', '') ~ '^\d+$'
      and (r.metadata->>'nb_actions')::int >= 20
  );
$$;

revoke all on function public.cloture_confirmee(date) from public, anon, authenticated;

-- ── 2. Le déclencheur conditionnel ──────────────────────────────────────────
-- Renvoie sa décision en texte : pg_cron la conserve dans cron.job_run_details,
-- c'est la trace de chaque passage (dispatché ou non, et pourquoi).
-- Ordre des tests = scraper/src/cloture/dispatch.ts (référence testée).
create or replace function public.dispatch_cloture_si_necessaire()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jour date := (now() at time zone 'UTC')::date;
  v_pat  text;
begin
  if extract(isodow from v_jour) > 5 then
    return 'week-end';
  end if;

  -- market_calendar ne déclare que les exceptions : une ligne
  -- is_trading_day = false ferme le jour, l'absence de ligne ne le ferme pas.
  if exists (select 1 from public.market_calendar where date = v_jour and is_trading_day = false) then
    return 'jour-ferme';
  end if;

  if public.cloture_confirmee(v_jour) then
    return 'deja-confirmee';
  end if;

  -- Un run `daily` déjà parti (cron GitHub ou passage précédent) : ne pas en
  -- empiler un second. Borné à 30 min pour qu'un run resté « running » après
  -- un runner tué ne bloque pas les passages suivants.
  if exists (
    select 1
    from public.scraper_runs r
    join public.scraper_sources s on s.id = r.source_id
    where s.code = 'daily'
      and r.status = 'running'
      and r.started_at >= now() - interval '30 minutes'
  ) then
    return 'run-en-cours';
  end if;

  select decrypted_secret into v_pat
  from vault.decrypted_secrets
  where name = 'github_pat_brvm'
  limit 1;

  if v_pat is null then
    raise warning 'dispatch_cloture_si_necessaire : secret Vault « github_pat_brvm » introuvable — rien envoyé';
    return 'jeton-absent';
  end if;

  perform net.http_post(
    url     := 'https://api.github.com/repos/ebouak/brvm-analyst-pro/actions/workflows/bdfin.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization',        'Bearer ' || v_pat,
      'Accept',               'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent',           'brvm-analyst-pro-pgcron',
      'Content-Type',         'application/json'
    ),
    body    := jsonb_build_object('ref', 'main')
  );
  return 'dispatch';
end;
$$;

revoke all on function public.dispatch_cloture_si_necessaire() from public, anon, authenticated;

-- ── 3. Planification (UTC) ──────────────────────────────────────────────────
-- Idempotent : on retire d'éventuels jobs homonymes avant de les recréer.
do $$
begin
  perform cron.unschedule('cloture-dispatch-15h');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('cloture-dispatch-16h-17h');
exception when others then null;
end $$;

-- 15:20 et 15:50
select cron.schedule(
  'cloture-dispatch-15h',
  '20,50 15 * * 1-5',
  $$select public.dispatch_cloture_si_necessaire();$$
);
-- 16:30 et 17:30
select cron.schedule(
  'cloture-dispatch-16h-17h',
  '30 16,17 * * 1-5',
  $$select public.dispatch_cloture_si_necessaire();$$
);

-- Vérification après application (à la clé publique, doit échouer) :
--   curl -X POST "$SUPABASE_URL/rest/v1/rpc/dispatch_cloture_si_necessaire" -H "apikey: <publishable>"
--   curl -X POST "$SUPABASE_URL/rest/v1/rpc/cloture_confirmee" -H "apikey: <publishable>" -d '{"p_seance":"2026-11-19"}'
-- Puis : select jobname, schedule from cron.job where jobname like 'cloture-dispatch%';
