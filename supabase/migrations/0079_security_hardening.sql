-- ============================================================================
-- 0079_security_hardening.sql
-- Audit d'intrusion 2026-07-09. Corrections :
--  P0 : IDOR via vues SECURITY DEFINER — la clé anon (sans login) exfiltrait
--       les positions paper trading de TOUS les users (user_id, prix, P&L)
--       via /rest/v1/vw_paper_trading_positions_open. Exploit confirmé.
--  P0 : fonctions destructrices/sensibles exécutables par anon
--       (purge_rgpd_retention, rls_auto_enable) — cf. 0080 pour REVOKE PUBLIC.
--  P1 : trigger functions SECURITY DEFINER exposées en RPC + search_path mutable.
--  P1 : forum_replies / formations — RLS active sans policy (feature morte).
-- ============================================================================

-- ── P0.1 — Vues : SECURITY DEFINER → security_invoker (la vue respecte la RLS
-- de l'appelant au lieu de celle du créateur). Les vues de données publiques
-- (marché) restent lisibles ; les vues sensibles se restreignent d'office. ───
alter view public.vw_paper_trading_positions_open set (security_invoker = true);
alter view public.vw_monthly_reports_published    set (security_invoker = true);
alter view public.vw_monthly_reports_pending       set (security_invoker = true);
alter view public.v_scraper_last_runs              set (security_invoker = true);
alter view public.v_scraper_stale                  set (security_invoker = true);
alter view public.instruments                      set (security_invoker = true);
alter view public.daily_quotes                     set (security_invoker = true);
alter view public.opportunity_scores               set (security_invoker = true);
alter view public.trading_days                     set (security_invoker = true);

-- Défense en profondeur : couper l'accès direct anon aux vues internes.
revoke select on public.vw_paper_trading_positions_open from anon;
revoke select on public.vw_monthly_reports_published    from anon;
revoke select on public.vw_monthly_reports_pending       from anon, authenticated;
revoke select on public.v_scraper_last_runs              from anon, authenticated;
revoke select on public.v_scraper_stale                  from anon, authenticated;

-- ── P1 — search_path figé sur les SECURITY DEFINER (anti search_path injection)
alter function public.ensure_author_profile()                set search_path = public, pg_temp;
alter function public.update_reputation_on_award()           set search_path = public, pg_temp;
alter function public.decrement_reputation_on_award_remove() set search_path = public, pg_temp;
alter function public.initialize_user_preferences()          set search_path = public, pg_temp;
alter function public.handle_new_user()                      set search_path = public, pg_temp;
alter function public.purge_rgpd_retention()                 set search_path = public, pg_temp;
alter function public.rls_auto_enable()                      set search_path = public, pg_temp;
alter function public.set_updated_at()                       set search_path = public, pg_temp;
alter function public.refresh_market_views()                 set search_path = public, pg_temp;
alter function public.check_quote_anomaly()                  set search_path = public, pg_temp;

-- ── P1 — forum_replies : RLS active mais aucune policy (feature réponses morte)
drop policy if exists "forum_replies_public_read" on public.forum_replies;
create policy "forum_replies_public_read"
  on public.forum_replies for select using (hidden = false);
drop policy if exists "forum_replies_owner_insert" on public.forum_replies;
create policy "forum_replies_owner_insert"
  on public.forum_replies for insert with check (auth.uid() = author_id);
drop policy if exists "forum_replies_owner_update" on public.forum_replies;
create policy "forum_replies_owner_update"
  on public.forum_replies for update using (auth.uid() = author_id);
drop policy if exists "forum_replies_owner_delete" on public.forum_replies;
create policy "forum_replies_owner_delete"
  on public.forum_replies for delete using (auth.uid() = author_id);

-- ── P1 — formations : lecture publique attendue
drop policy if exists "formations_public_read" on public.formations;
create policy "formations_public_read"
  on public.formations for select using (true);
