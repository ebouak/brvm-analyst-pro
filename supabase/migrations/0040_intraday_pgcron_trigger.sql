-- ============================================================================
-- Déclencheur FIABLE de l'intraday via pg_cron (le `schedule` GitHub Actions
-- est best-effort et saute fréquemment des ticks → données non rafraîchies).
--
-- Principe : pg_cron (dans Supabase, très fiable) appelle l'API GitHub
-- workflow_dispatch toutes les 15 min en séance, ce qui lance le workflow
-- `intraday.yml`. Le PAT GitHub n'apparaît JAMAIS en clair : il est lu depuis
-- Supabase Vault (secret « github_pat_brvm »).
--
-- PRÉREQUIS (à faire UNE FOIS, voir aussi les instructions hors-SQL) :
--   1. Créer un PAT GitHub *fine-grained* limité au repo ebouak/brvm-analyst-pro
--      avec la permission « Actions : Read and write ».
--   2. L'enregistrer dans Vault :
--        select vault.create_secret('<COLLER_LE_PAT_ICI>', 'github_pat_brvm');
--   3. Appliquer cette migration.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Déclenche le workflow intraday.yml sur la branche main.
create or replace function public.trigger_intraday_workflow()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pat text;
begin
  select decrypted_secret into v_pat
  from vault.decrypted_secrets
  where name = 'github_pat_brvm'
  limit 1;

  if v_pat is null then
    raise warning 'trigger_intraday_workflow: secret Vault « github_pat_brvm » introuvable — rien envoyé';
    return;
  end if;

  perform net.http_post(
    url     := 'https://api.github.com/repos/ebouak/brvm-analyst-pro/actions/workflows/intraday.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization',        'Bearer ' || v_pat,
      'Accept',               'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent',           'brvm-analyst-pro-pgcron',
      'Content-Type',         'application/json'
    ),
    body    := jsonb_build_object('ref', 'main')
  );
end;
$$;

-- Réservé : jamais exposé aux rôles applicatifs (seul pg_cron l'appelle).
revoke all on function public.trigger_intraday_workflow() from public, anon, authenticated;

-- Planifie toutes les 15 min, lun-ven, 09:00–15:45 UTC (séance BRVM, Abidjan = UTC).
-- pg_cron tourne en UTC sur Supabase. Idempotent : on supprime l'éventuel job homonyme.
do $$
begin
  perform cron.unschedule('intraday-dispatch');
exception when others then
  null; -- pas encore planifié
end $$;

select cron.schedule(
  'intraday-dispatch',
  '*/15 9-15 * * 1-5',
  $$select public.trigger_intraday_workflow();$$
);
