-- 0222 — BBGC (Bridge Bank Group Côte d'Ivoire) : famille comptable « banque », pays « CI ».
--
-- La migration 0140 prévoyait famille_comptable = 'banque' ; en production, BBGC
-- était resté « general » (constaté le 2026-11-13) et son pays vide. Cette
-- migration ne reprend que ces deux colonnes :
--  - pays au format des autres sociétés (code à deux lettres), et non le
--    « Côte d'Ivoire » en toutes lettres de 0140 ;
--  - la désignation publiée par la BRVM n'est pas touchée.
-- Le registre du code (frontend/lib/financials/sectors.ts, FAMILLE_PAR_CODE) classe
-- déjà BBGC en banque. Idempotente. Aucune donnée personnelle.

update public.brvm_instruments
   set famille_comptable = 'banque',
       pays = coalesce(pays, 'CI'),
       updated_at = now()
 where code = 'BBGC';
