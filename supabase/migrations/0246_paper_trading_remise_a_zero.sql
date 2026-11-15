-- 0246 — Portefeuille virtuel : remise à zéro (2026-11-15).
--
-- Demande de l'exploitant : « vider toute les positions comme neuf ».
--
-- Pourquoi : la tâche automatique `paper-trading-auto` (désactivée le
-- 2026-11-06 : elle ouvrait des positions dans les comptes sans accord) avait
-- laissé 23 positions ouvertes pour 11,46 M FCFA de coût sur un capital de
-- 6,16 M FCFA. Le cash disponible étant négatif, `/api/paper-trading/positions`
-- levait une erreur et la page affichait « Impossible de vérifier le compte
-- simulé ».
--
-- Effet : toutes les positions (ouvertes et fermées), ordres et exécutions du
-- portefeuille virtuel sont supprimés ; chaque compte repart de son capital
-- initial, P&L à zéro. Les comptes eux-mêmes (capital choisi, choix du
-- classement) sont conservés.
--
-- Sauvegarde : export JSON des quatre tables pris juste avant, conservé hors du
-- dépôt (il contient des identifiants d'utilisateur). Au 2026-11-15 : 1 compte,
-- 44 positions, 0 ordre, 0 exécution.
--
-- Idempotent : un second passage ne trouve plus rien à supprimer et remet les
-- mêmes valeurs. La tâche automatique reste désactivée.

begin;

delete from public.paper_trading_fills;
delete from public.paper_trading_orders;
delete from public.paper_trading_positions;

update public.paper_trading_accounts
   set capital_current = capital_initial,
       pnl_total = 0,
       pnl_pct = 0,
       updated_at = now()
 where capital_current is distinct from capital_initial
    or pnl_total <> 0
    or pnl_pct <> 0;

commit;

-- Vérification : attendu 0 position, 0 ordre, 0 exécution, capital_current = capital_initial.
-- select (select count(*) from public.paper_trading_positions) positions,
--        (select count(*) from public.paper_trading_orders) ordres,
--        (select count(*) from public.paper_trading_fills) executions,
--        (select count(*) from public.paper_trading_accounts where capital_current <> capital_initial) comptes_decales;
