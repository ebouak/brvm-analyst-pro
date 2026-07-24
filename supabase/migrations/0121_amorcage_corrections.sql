-- 0121 — Amorçage de correction_champ avec les corrections des migrations
-- 0115 à 0119. L'historique démarre avec des cas documentés plutôt qu'une table
-- vide, et la règle de promotion (source externe -> confiance 'verifie') peut
-- s'appliquer immédiatement aux exercices concernés.
--
-- ORDRE D'APPLICATION : 0120, puis le backfill
-- (npx tsx scripts/backfill-provenance.ts --write), PUIS cette migration.
-- La promotion ci-dessous suppose que les lignes de provenance existent déjà.
--
-- Idempotence : insertion conditionnée à l'absence d'une ligne identique.

insert into public.correction_champ
  (table_cible, code, periode, champ, valeur_avant, valeur_apres, motif, source_externe, corrige_par)
select v.* from (values
  ('income_statements','CIEC','2022','resultat_net', 10261000000::numeric, 9819000000::numeric,
   'Ré-extraction PDF ayant écrasé une valeur correcte ; restaurée après contrôle externe.',
   'Sika Finance','migration 0117'),
  ('income_statements','CIEC','2023','resultat_net', 11485000000, 10633000000,
   'Ré-extraction PDF ayant écrasé une valeur correcte ; restaurée après contrôle externe.',
   'Sika Finance','migration 0117'),
  ('income_statements','CIEC','2024','resultat_net', 10555000000, 10101000000,
   'Ré-extraction PDF ayant écrasé une valeur correcte ; restaurée après contrôle externe.',
   'Sika Finance','migration 0117'),
  ('income_statements','SHEC','2022','resultat_net', 3548638458, 3753000000,
   'Ré-extraction PDF ayant écrasé une valeur correcte ; restaurée après contrôle externe.',
   'Sika Finance','migration 0117'),
  ('income_statements','CIEC','2022','benefice_par_action', 183, 175.34,
   'BPA incohérent : le nombre d''actions implicite variait de 51,9 M à 53,7 M ; la série retenue donne 56 000 000 stable.',
   'Madis Invest','migration 0118'),
  ('income_statements','CIEC','2023','benefice_par_action', 205, 189.88,
   'BPA incohérent : le nombre d''actions implicite variait de 51,9 M à 53,7 M ; la série retenue donne 56 000 000 stable.',
   'Madis Invest','migration 0118'),
  ('income_statements','CIEC','2024','benefice_par_action', 188, 180.38,
   'BPA incohérent : le nombre d''actions implicite variait de 51,9 M à 53,7 M ; la série retenue donne 56 000 000 stable.',
   'Madis Invest','migration 0118'),
  ('income_statements','TTLS','2025','resultat_net', 6779000000, 6146000000,
   'Deux sources indépendantes concordantes contre la valeur en base ; le chiffre d''affaires concordait déjà sur les 5 exercices.',
   'Madis Invest + Sika Finance','migration 0119'),
  ('cash_flow_statements','ETIT','2025','flux_exploitation', 1172891000, 682427862094,
   'Flux extraits de la série USD du document et stockés comme des francs ; convertis au taux moyen d''exercice (IAS 21).',
   'Publication ETI + BCE','migration 0115/0116')
) as v(table_cible, code, periode, champ, valeur_avant, valeur_apres, motif, source_externe, corrige_par)
where not exists (
  select 1 from public.correction_champ c
  where c.code = v.code and c.periode = v.periode and c.champ = v.champ
    and c.table_cible = v.table_cible
);

-- Promotion : tout exercice ayant une correction adossée à une source externe
-- passe à 'verifie'. Cohérent avec doitPromouvoir() côté TypeScript, qui applique
-- exactement la même règle (source externe non vide, espaces exclus).
update public.provenance_exercice p set confiance = 'verifie'
where exists (
  select 1 from public.correction_champ c
  where c.code = p.code and c.periode = p.periode and c.table_cible = p.table_cible
    and c.source_externe is not null and btrim(c.source_externe) <> ''
);
