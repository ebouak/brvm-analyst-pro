-- Audit sécurité (Cloudflare) : « Users can write arbitrary pnl_pct on their paper
-- trading account and top the public leaderboard ».
--
-- Les policies d'écriture « own » (0029) laissaient un compte connecté faire, via
-- PostgREST, UPDATE paper_trading_accounts SET pnl_pct = 9999 (ou fabriquer des
-- positions gagnantes) et apparaître en tête du classement public
-- (get_paper_leaderboard, opt-in). Les métriques (capital, pnl, positions) ne
-- doivent être écrites que par le serveur.
--
-- Correctif :
--  * plus d'INSERT/UPDATE/DELETE pour anon/authenticated sur les deux tables ;
--  * UPDATE colonne par colonne réaccordé à authenticated sur
--    paper_trading_accounts(leaderboard_optin, leaderboard_alias) seulement
--    (route /api/paper-trading/leaderboard, session utilisateur) ;
--  * création de compte, ouverture/renfort/clôture de position passent par des
--    routes serveur en service_role (user_id issu de la session).
-- Les policies INSERT sont supprimées ; la policy UPDATE du compte reste (avec
-- les grants de colonnes elle ne permet plus que l'opt-in et l'alias).
-- Idempotent.

drop policy if exists "Users can insert paper_trading_accounts (own)" on public.paper_trading_accounts;
drop policy if exists "Users can insert paper_trading_positions (own)" on public.paper_trading_positions;
drop policy if exists "Users can update paper_trading_positions (own)" on public.paper_trading_positions;

revoke insert, update, delete on public.paper_trading_accounts  from public, anon, authenticated;
revoke insert, update, delete on public.paper_trading_positions from public, anon, authenticated;

grant update (leaderboard_optin, leaderboard_alias) on public.paper_trading_accounts to authenticated;
