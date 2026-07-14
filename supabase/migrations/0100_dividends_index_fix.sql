-- 0100 — Correctif : l'index unique PARTIEL de 0099 est inutilisable par l'upsert.
--
-- ERREUR CONSTATÉE à l'exécution :
--   « there is no unique or exclusion constraint matching the ON CONFLICT specification »
--
-- CAUSE : 0099 créait un index unique PARTIEL (`where exercice is not null`).
-- PostgreSQL n'associe un `ON CONFLICT (code, exercice)` à un index partiel que si
-- la requête répète le MÊME prédicat — ce que PostgREST (et donc supabase-js)
-- n'émet pas. L'index existait, il était simplement invisible pour l'upsert.
--
-- CORRECTIF : index unique COMPLET. Le comportement est identique pour nous :
-- PostgreSQL traite les NULL comme DISTINCTS, donc plusieurs lignes (code, NULL)
-- restent autorisées — exactement la tolérance que le prédicat visait (dividendes
-- annoncés dont l'exercice n'est pas encore identifié, utilisés par le calendrier).

drop index if exists public.dividends_code_exercice_uniq;

create unique index if not exists dividends_code_exercice_uniq
  on public.dividends (code, exercice);

-- Contrôle : l'index doit être NON partiel (indpred vide).
--   select indexname, indexdef from pg_indexes
--    where tablename = 'dividends' and indexname = 'dividends_code_exercice_uniq';
