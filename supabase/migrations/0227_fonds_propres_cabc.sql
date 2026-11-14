-- 0227 — Fonds propres de CABC (SICABLE CI) lus dans les états financiers
-- officiels (2026-11-14). CABC n'avait que des lignes Sika (chiffre
-- d'affaires et résultat, sans fonds propres) : valorisation impossible.
--
-- Sources (brvm.org, publications) :
--  - « Etats financiers SYSCOHADA - Exercice 2025 - SICABLE CI » (20260310) :
--    comptes PROVISOIRES, non encore approuvés par l'AG, vérifiés par les
--    commissaires aux comptes (mention du document).
--  - « Etats financiers - Exercice 2024 - SICABLE CI » (20250903) : approuvés ;
--    colonne 31/12/2023 pour 2023.
-- Capitaux propres = capital + primes et réserves + résultat, VÉRIFIÉS par
-- différence (total passif − dettes financières − passif circulant), égalité
-- exacte pour les trois exercices :
--   2025 : 740 000 000 + 6 541 093 600 + 1 704 451 144 = 8 985 544 744
--   2024 : 740 000 000 + 6 074 618 060 + 1 224 827 540 = 8 039 445 600
--   2023 : 740 000 000 + 5 168 257 814 + 1 429 806 646 = 7 338 064 460
-- Résultats nets conformes à la base (1 704 / 1 225 / 1 430 M).
--
-- On ne remplit que le vide ; jamais une ligne vérifiée à la main.
-- Aucune donnée personnelle.

-- Bilan 2025 (seule ligne existante) ; le déclencheur fp_depuis_bilan (0223)
-- reporte vers fundamentals 2025.
update public.balance_sheets
   set total_capitaux_propres = 8985544744
 where code = 'CABC' and periode = '2025' and type_periode = 'annuel'
   and total_capitaux_propres is null;

-- 2023 et 2024 : pas de ligne de bilan, report direct.
update public.fundamentals f
   set equity = v.cp, updated_at = now()
  from (values (2025, 8985544744::bigint), (2024, 8039445600::bigint), (2023, 7338064460::bigint)) as v(year, cp)
 where f.code = 'CABC' and f.year = v.year
   and f.equity is null
   and coalesce(f.source, '') <> 'pdf-verified';
