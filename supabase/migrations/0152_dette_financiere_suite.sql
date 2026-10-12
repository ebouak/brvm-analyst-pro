-- 0152 — Dette financière : suite de 0151 (2026-10-12).
--
-- Mêmes règles que 0151 : dette = emprunts (y compris location-acquisition
-- quand le bilan en base les y range) + trésorerie-passif / concours
-- bancaires ; dettes locatives IFRS 16 exclues. Chaque ligne vérifiée sur le
-- document publié. IDEMPOTENT : chaque UPDATE exige l'ancienne valeur.
begin;

-- ── PDF scannés, lus par Gemini (gemini-3.8-flash), recoupés avec la base ──
-- PRSC 2025 : 7,49 -> 7,15 Md. EF 2025 p.2 : emprunts 8 000 000 + location-acquisition
-- 856 121 065 (= long terme en base 864 121 065) + trésorerie-passif 6 287 553 511.
update fundamentals set debt = 7151674576, updated_at = now() where code = 'PRSC' and year = 2025 and debt = 7490000000;
-- PRSC 2023 : 1,37 -> 4,70 Md. EF 2023 (annule et remplace) : emprunts 1 371 M + trésorerie-passif 3 325 M.
update fundamentals set debt = 4696000000, updated_at = now() where code = 'PRSC' and year = 2023 and debt = 1371000000;
-- SICC 2021 / 2020 : 0 -> trésorerie-passif seule (aucun emprunt). EF 2021 : 6 965 332 / 51 704 261 FCFA.
update fundamentals set debt = 6965332, updated_at = now() where code = 'SICC' and year = 2021 and debt = 0;
update fundamentals set debt = 51704261, updated_at = now() where code = 'SICC' and year = 2020 and debt = 0;
-- SDSC 2025 : 8,23 -> 10,23 Md. EF certifiés 2025 (milliers) : emprunts 8 230 970 + trésorerie-passif 2 000 000.
update fundamentals set debt = 10230970000, updated_at = now() where code = 'SDSC' and year = 2025 and debt = 8230970000;
-- ABJC : AUCUNE correction. EF IFRS 2025 et 2022 : emprunts 66 / 79 / 68 M, aucun
-- concours bancaire ; la base (long terme seul) est juste.

-- ── SCRC : fondamentaux en IFRS (montants = emprunts non courants IFRS), donc ──
-- dette IFRS = non courant + part courante + concours bancaires, hors loyers.
-- 2025 et 2024 : version « annule et remplace » des EF 2025 (milliers).
update fundamentals set debt = 78176839000, updated_at = now() where code = 'SCRC' and year = 2025 and debt = 39360457000; -- 39 360 457 + 27 798 090 + 11 018 292
update fundamentals set debt = 45717880000, updated_at = now() where code = 'SCRC' and year = 2024 and debt = 24112181000; -- 24 112 181 + 6 196 370 + 15 409 329
-- 2023 et 2022 : EF IFRS 2023 (milliers).
update fundamentals set debt = 51290751000, updated_at = now() where code = 'SCRC' and year = 2023 and debt = 30127136000; -- 30 127 136 + 5 766 744 + 15 396 871
update fundamentals set debt = 56430276000, updated_at = now() where code = 'SCRC' and year = 2022 and debt = 35888301000; -- 35 888 301 + 5 298 717 + 15 243 258

-- ── SHEC 2022 : recoupé avec les EF définitifs publiés par RichBourse (03/11/2023). ──
-- Le long terme 2022 était à 0 ; le document donne « Dettes financières et ressources
-- assimilées » 12 675 296 717, la ligne même que la base retient pour 2021
-- (13 516 437 207). Trésorerie-passif 4 343 761 139 (= base).
update balance_sheets set dette_long_terme = 12675296717 where code = 'SHEC' and periode = '2022' and type_periode = 'annuel' and dette_long_terme = 0;
update fundamentals set debt = 17019057856, updated_at = now() where code = 'SHEC' and year = 2022 and debt = 0;

-- ── PALC : référence « pdf-verified », corrigée sur décision explicite (2026-10-12). ──
-- EF 2025 (milliers) : dettes financières et ressources assimilées 796 559 / 4 047 029
-- + trésorerie-passif 14 047 180 / 22 021 633 (colonnes 2025 / 2024).
update fundamentals set debt = 14843739000, updated_at = now() where code = 'PALC' and year = 2025 and debt = 796559000;
update fundamentals set debt = 26068662000, updated_at = now() where code = 'PALC' and year = 2024 and debt = 4047029000;

commit;
