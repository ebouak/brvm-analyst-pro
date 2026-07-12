-- ============================================================================
-- 0089_drop_patterns_raw.sql
-- Suppression de brvm_intraday_patterns_raw (table morte).
--
-- Constats (2026-07-13) :
--  - la fonction qui y écrivait (upsertRawPatterns) n'était appelée nulle part ;
--  - `qualifyPatterns` ne filtre rien → brvm_intraday_patterns contient déjà
--    tout ce que la table « raw » aurait reçu ;
--  - la vraie donnée brute vit dans brvm_intraday_snapshots (conservée) : toute
--    mesure se RECALCULE (commande scraper `intraday:calibrate`) ;
--  - aucun usage frontend.
--
-- La table est vide (purge r1.0.0 faite en 0088) : aucun risque de perte.
-- ============================================================================

drop table if exists public.brvm_intraday_patterns_raw;
