-- 0225 — Fonds propres faux de NSBC et SIBC, corrigés sur les états financiers
-- officiels (2026-11-14). Même défaut que NTLC (0224) : deux exercices portant
-- la même valeur. Repéré par la requête « même equity sur deux années ».
--
-- Sources (bfin.brvm.org, Communiqués émetteurs) :
--  - NSBC : « Etats financiers - Exercice 2025 - NSIA BANQUE CI » (20260513).
--    Capitaux propres et ressources assimilées, en millions : 2025 = 233 303,
--    2024 = 211 371. Vérifié par la somme des postes (capital 24 735 + primes
--    29 992 + réserves 41 121 + report à nouveau 96 743 + résultat 40 712 =
--    233 303 ; 2024 : 24 735 + 29 992 + 35 404 + 83 128 + 38 112 = 211 371).
--    La base recopiait 211 371 sur 2025. 2024 est juste et n'est pas touché.
--  - SIBC : « Rapport d'activités annuel et Etats Financiers - Exercice 2025 -
--    SIB CI » (20260421), bilan page 5, ligne P9, en millions : 2024 = 187 136,
--    2025 = 204 765 (capital 20 000 + réserves + résultat ; repris aussi page 3,
--    « Capitaux propres 187 / 205 Md »). La base portait 196 485 sur les deux
--    exercices : c'est la VARIATION du total du bilan (colonne Var N/N-1).
--
-- Garde : seulement si la valeur fausse constatée est encore en place, jamais
-- une ligne vérifiée à la main. Aucune donnée personnelle.

update public.balance_sheets b
   set total_capitaux_propres = v.cp
  from (values
          ('NSBC', '2025', 211371000000::bigint, 233303000000::bigint),
          ('SIBC', '2024', 196485000000::bigint, 187136000000::bigint),
          ('SIBC', '2025', 196485000000::bigint, 204765000000::bigint)
       ) as v(code, periode, faux, cp)
 where b.code = v.code
   and b.periode = v.periode
   and b.type_periode = 'annuel'
   and b.total_capitaux_propres = v.faux;

update public.fundamentals f
   set equity = v.cp, updated_at = now()
  from (values
          ('NSBC', 2025, 211371000000::bigint, 233303000000::bigint),
          ('SIBC', 2024, 196485000000::bigint, 187136000000::bigint),
          ('SIBC', 2025, 196485000000::bigint, 204765000000::bigint)
       ) as v(code, year, faux, cp)
 where f.code = v.code
   and f.year = v.year
   and f.equity = v.faux
   and coalesce(f.source, '') <> 'pdf-verified';
