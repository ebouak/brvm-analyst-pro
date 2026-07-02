-- ============================================================================
-- 0066_realtime_cours.sql
-- Piste WAOUH 1/5 — temps réel : active Supabase Realtime sur les cours pour
-- que la nouvelle donnée (écrite par le cron intraday) apparaisse
-- instantanément sur les onglets déjà ouverts (sans reload), avec flash.
--
-- Les deux tables ont déjà une policy SELECT publique (vérifié) → l'abonnement
-- via la clé anon fonctionne sous RLS sans changement de policy. Realtime ne
-- fait que retransmettre ce que le cron écrit : aucune donnée fabriquée.
-- ============================================================================

-- Idempotent : n'ajoute que si la table n'est pas déjà dans la publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'brvm_actions_daily'
  ) then
    alter publication supabase_realtime add table public.brvm_actions_daily;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'brvm_indices_daily'
  ) then
    alter publication supabase_realtime add table public.brvm_indices_daily;
  end if;
end $$;
