-- supabase/migrations/0042_rgpd_retention.sql
-- RGPD — Rétention : purge planifiée des données personnelles à durée limitée.
--   - admin_audit_logs : contient IP + user-agent (données perso) → 12 mois.
--   - notifications_log : journal d'envois (user_id) → 12 mois.
-- Voir docs/RGPD.md §5 (constats 2 et la base « durée de conservation »).
--
-- ⚠️ Cette migration planifie des SUPPRESSIONS récurrentes. À appliquer en
--    connaissance de cause (Supabase SQL editor ou `supabase db push`).

-- 1. Fonction de purge (idempotente, sûre à ré-exécuter).
create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
end;
$$;

comment on function public.purge_rgpd_retention is
  'Purge RGPD : supprime admin_audit_logs et notifications_log de plus de 12 mois.';

-- 2. Planification mensuelle via pg_cron, si l'extension est présente.
--    Idempotent : on déprogramme un éventuel job homonyme avant de (re)planifier.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('rgpd-retention-monthly');
    exception when others then
      null; -- aucun job existant : on ignore.
    end;
    perform cron.schedule(
      'rgpd-retention-monthly',
      '0 3 1 * *',  -- le 1er de chaque mois à 03:00 UTC
      'select public.purge_rgpd_retention();'
    );
  else
    raise notice 'pg_cron absent : exécuter public.purge_rgpd_retention() via un planificateur externe.';
  end if;
exception when others then
  raise notice 'Planification rgpd-retention non effectuée (%).', sqlerrm;
end $$;
