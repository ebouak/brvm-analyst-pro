-- ============================================================================
-- 0088_intraday_fixing_signals.sql
-- Le moteur de patterns intraday passe de l'ATR aux signaux de FIXING.
--
-- POURQUOI (diagnostic 2026-07-12, données réelles séance du 2026-07-10) :
-- la BRVM est un marché de fixing, pas un marché continu. Le titre le plus actif
-- n'a connu que 7 prix distincts dans la journée ; SNTS (le plus liquide) a bougé
-- de 0,32 % entre 4 prix. Le cron capturant toutes les 15 min, chaque bougie de
-- 15 min ne contenait qu'UN point (open = high = low = close) → amplitude vraie
-- NULLE → l'ATR (true range) et la consolidation (ratio corps/amplitude) n'avaient
-- mathématiquement rien à mesurer. D'où 0 pattern produit depuis la mise en
-- service du cron. Aucun réglage de seuil n'y aurait changé quoi que ce soit.
--
-- NOUVEAUX SIGNAUX (scraper/src/intraday/indicators/fixingSignals.ts) :
--   intraday_momentum : direction depuis l'ouverture (seuil 3 %)
--   volume_spike      : volume de séance vs moyenne 20 j (seuil 2×)
-- Le signal porte sur la SÉANCE entière (timeframe = 'session'), plus sur une
-- bougie de 15 min qui n'existe pas ici.
--
-- Cette migration lève les contraintes qui rejetteraient les nouvelles valeurs.
-- Aucune donnée supprimée : les lignes ATR historiques restent lisibles.
-- ============================================================================

-- 1) timeframe : autoriser 'session' (le signal couvre la journée, pas une bougie).
alter table public.brvm_intraday_patterns_raw
  drop constraint if exists brvm_intraday_patterns_raw_timeframe_check;
alter table public.brvm_intraday_patterns
  drop constraint if exists brvm_intraday_patterns_timeframe_check;

alter table public.brvm_intraday_patterns_raw
  add constraint brvm_intraday_patterns_raw_timeframe_check
  check (timeframe in ('15m', '30m', '1h', 'daily', 'session'));

alter table public.brvm_intraday_patterns
  add constraint brvm_intraday_patterns_timeframe_check
  check (timeframe in ('15m', '30m', '1h', 'daily', 'session'));

-- 2) pattern_type : la contrainte avait déjà été retirée (0082) sur `patterns`.
--    On la retire aussi sur `patterns_raw` si elle subsiste — les types évoluent
--    avec le moteur, et une contrainte figée a déjà bloqué un déploiement.
alter table public.brvm_intraday_patterns_raw
  drop constraint if exists brvm_intraday_patterns_raw_pattern_type_check;

comment on column public.brvm_intraday_patterns_raw.pattern_type is
  'intraday_momentum | volume_spike (moteur fixing, r2.0.0). atr_extreme / bullish_consolidation : hérités, plus produits — inapplicables à un marché de fixing.';

comment on column public.brvm_intraday_patterns_raw.metadata is
  'jsonb. Pour intraday_momentum : {"direction":"up"|"down"} — `value` ne porte que la MAGNITUDE (la qualification calcule value/threshold), donc le sens du mouvement vit ici.';
