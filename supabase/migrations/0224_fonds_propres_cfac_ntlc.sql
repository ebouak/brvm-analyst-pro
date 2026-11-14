-- 0224 — Fonds propres de CFAC et NTLC lus dans les états financiers officiels
-- (2026-11-14). Complète 0223 pour deux des trois sociétés restées sans fonds
-- propres ; corrige deux valeurs fausses de NTLC.
--
-- Sources (bfin.brvm.org, Communiqués émetteurs), relues page par page :
--  - CFAC : « Etats financiers - Exercice 2024 - CFAO MOTORS CI » (20250516),
--    bilan SYSCOHADA, ligne CP « Total capitaux propres et ressources
--    assimilées » = 19 452 985 667 (N) ; N-1 = 17 979 153 259, identique à la
--    valeur 2023 déjà en base (même convention). Résultat net 4 693 479 450,
--    conforme à la base (4 693 M).
--    Exercice 2025 : seul un rapport d'activité est publié, sans bilan → rien.
--  - NTLC : « Etats financiers - Exercice 2025 / 2024 / 2023 - NESTLE CI ».
--    Pas de total publié : somme capital + prime de fusion + écart de
--    réévaluation + réserves + report à nouveau + résultat, VÉRIFIÉE par
--    différence (total passif − emprunt − autres dettes financières − passif
--    circulant − trésorerie passif − écart de conversion passif), égalité
--    exacte pour les quatre exercices :
--      2025 : 29 588 107 165   2024 : 29 258 935 686
--      2023 : 27 661 768 599   2022 : 28 960 023 737
--    La base portait 59 897 910 187 pour 2022 ET 2023 : valeur fausse
--    (le double environ), corrigée ici sous garde de la valeur exacte.
--  - SEMC : le rapport annuel 2023 ne publie pas de bilan chiffré (pages des
--    commissaires aux comptes en image) → rien, la société reste « non
--    estimable ». Aucune estimation.
--
-- Aucune donnée personnelle. Mises à jour gardées : un relancement ne change rien.

-- 1. Bilans annuels : on ne remplit que le vide. Le déclencheur fp_depuis_bilan
--    (0223) reporte vers fundamentals.equity quand celle-ci est vide.
update public.balance_sheets b
   set total_capitaux_propres = v.cp
  from (values
          ('CFAC', '2024', 19452985667::bigint),
          ('NTLC', '2025', 29588107165::bigint),
          ('NTLC', '2024', 29258935686::bigint),
          ('NTLC', '2023', 27661768599::bigint),
          ('NTLC', '2022', 28960023737::bigint)
       ) as v(code, periode, cp)
 where b.code = v.code
   and b.periode = v.periode
   and b.type_periode = 'annuel'
   and b.total_capitaux_propres is null;

-- 2. NTLC 2022 et 2023 : correction de la valeur fausse, seulement si elle est
--    encore celle constatée (jamais une ligne vérifiée à la main).
update public.fundamentals f
   set equity = v.cp, updated_at = now()
  from (values (2023, 27661768599::bigint), (2022, 28960023737::bigint)) as v(year, cp)
 where f.code = 'NTLC'
   and f.year = v.year
   and f.equity = 59897910187
   and coalesce(f.source, '') <> 'pdf-verified';
