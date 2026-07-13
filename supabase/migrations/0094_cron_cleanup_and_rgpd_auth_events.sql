-- 0094 — Nettoyage des crons zombies + rétention RGPD de auth_events.
--
-- Constaté dans cron.job_run_details (7 derniers jours) :
--   trigger-github-workflow-15min : 672 échecs, 0 succès
--   scrape-bdfin-daily            :   5 échecs, 0 succès
--   intraday-dispatch             : 140 SUCCÈS   ← celui qui marche
--   refresh-market-views          :   5 succès
--
-- Personne ne le voyait : /admin/scraping lit `scraper_runs`, pas `pg_cron`.

-- ── 1. trigger-github-workflow-15min ─────────────────────────────────────────
-- Appelle `decrypt_secret('github_pat_brvm')` — fonction qui N'EXISTE PAS
-- (l'API Vault correcte est `vault.decrypted_secrets`). Échoue à chaque
-- exécution, toutes les 15 min, 24 h/24 (même la nuit et le week-end).
--
-- Il est de surcroît REDONDANT : `intraday-dispatch` déclenche le même workflow
-- GitHub (intraday.yml) via `trigger_intraday_workflow()`, qui lit correctement
-- le Vault et réussit (140 exécutions). On SUPPRIME plutôt que de réparer :
-- réparer donnerait deux déclencheurs concurrents du même workflow.
select cron.unschedule('trigger-github-workflow-15min');

-- ── 2. scrape-bdfin-daily ────────────────────────────────────────────────────
-- Son URL contient le littéral « <PROJECT_REF> » : le gabarit n'a jamais été
-- rempli, le job n'a donc JAMAIS fonctionné.
--
-- Sans objet aujourd'hui : la séance quotidienne BDFIN est collectée par le
-- workflow GitHub `bdfin.yml` (cron '30 16 * * 1-5'), qui lui fonctionne.
select cron.unschedule('scrape-bdfin-daily');

-- ── 3. Rétention RGPD de auth_events ─────────────────────────────────────────
-- `auth_events` (migration 0092) stocke des ADRESSES IP = donnée personnelle.
-- On a annoncé 12 mois de conservation… mais `purge_rgpd_retention()` ne purgeait
-- que `admin_audit_logs` et `notifications_log`. La table n'était donc JAMAIS
-- purgée : la promesse de rétention n'était pas tenue.
--
-- On intègre la purge à la fonction déjà planifiée (cron `rgpd-retention-monthly`,
-- le 1er du mois à 03:00) plutôt que d'ajouter un second job : une seule fonction
-- = un seul endroit à lire pour savoir ce qui est purgé, et pas de dérive entre
-- deux calendriers.
create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  -- Journal des connexions : IP + user-agent (données personnelles, 12 mois).
  delete from public.auth_events        where created_at < now() - interval '12 months';
end;
$function$;

-- Les trois rôles : révoquer PUBLIC seul ne retire pas les grants NOMINATIFS que
-- Supabase accorde par défaut à anon/authenticated (cf. migration 0093).
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;

-- `purge_auth_events()` (0092) devient redondante : sa logique vit désormais dans
-- purge_rgpd_retention(). La garder serait entretenir deux sources de vérité sur
-- la rétention — celle qu'on planifie, et celle qu'on oublie.
drop function if exists public.purge_auth_events();
