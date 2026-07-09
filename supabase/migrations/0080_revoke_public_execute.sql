-- ============================================================================
-- 0080_revoke_public_execute.sql
-- FIX du 0079 : en Postgres, EXECUTE est accordé à PUBLIC par défaut sur toute
-- fonction. Le « REVOKE ... FROM anon » de 0079 était donc insuffisant — anon
-- et authenticated héritaient d'EXECUTE via le rôle PUBLIC.
--
-- Exploit vérifié avant correctif : POST /rest/v1/rpc/purge_rgpd_retention avec
-- la seule clé anon renvoyait 204 (purge RGPD réellement déclenchée !) ;
-- rls_auto_enable renvoyait 400 (exécutée, échec à la sérialisation seulement).
-- Après ce REVOKE FROM public : 401 permission denied sur les deux.
-- ============================================================================

revoke execute on function public.purge_rgpd_retention()                 from public;
revoke execute on function public.rls_auto_enable()                      from public;
revoke execute on function public.ensure_author_profile()                from public;
revoke execute on function public.update_reputation_on_award()           from public;
revoke execute on function public.decrement_reputation_on_award_remove() from public;
revoke execute on function public.initialize_user_preferences()          from public;
revoke execute on function public.handle_new_user()                      from public;
