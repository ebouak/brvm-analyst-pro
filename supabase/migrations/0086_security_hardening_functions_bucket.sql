-- ============================================================================
-- 0086_security_hardening_functions_bucket.sql
-- Durcissement pré-go-live (get_advisors 2026-07-10).
--
-- 1) search_path immuable sur les 4 fonctions trigger signalées (lint
--    function_search_path_mutable). Elles n'utilisent que now() → search_path
--    vide sans effet fonctionnel.
-- 2) Bucket public brief-audio : suppression de la policy SELECT large qui
--    permettait de LISTER tous les fichiers (lint public_bucket_allows_listing).
--    Les URL publiques des objets restent accessibles (bucket public).
--
-- Audité sans changement : get_paper_leaderboard (SECURITY DEFINER exécutable
-- par anon) est VOLONTAIREMENT public — opt-in leaderboard_optin=true, alias
-- pseudonymisé, aucun email/user_id exposé.
-- ============================================================================

alter function public.update_paper_trading_accounts_updated_at() set search_path = '';
alter function public.update_paper_trading_positions_updated_at() set search_path = '';
alter function public.update_monthly_reports_updated_at() set search_path = '';
alter function public.set_nl_prefs_updated_at() set search_path = '';

drop policy if exists "lecture publique brief-audio" on storage.objects;
