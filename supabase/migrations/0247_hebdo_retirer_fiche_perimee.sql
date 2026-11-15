-- 0247 — Analyse hebdo du 13/11/2026 : retrait de la fiche NSBC périmée (2026-11-15).
--
-- L'édition du 13/11 a été régénérée le 15/11 avec le moteur enrichi (#308)
-- à la demande de l'exploitant. Le nouveau moteur retient UNXC à la place de
-- NSBC ; l'écriture se faisant par upsert (edition_id, code), l'ancienne fiche
-- NSBC est restée dans l'édition, avec l'ancien texte (sans `metrics.analyse`),
-- à côté de cinq fiches du nouveau moteur.
--
-- Effet : supprime cette seule ligne. Garde stricte : édition du 2026-11-13,
-- code NSBC, ET fiche de l'ancien moteur (pas de clé `analyse`). Idempotent.

delete from public.hebdo_items i
 using public.hebdo_editions e
 where e.id = i.edition_id
   and e.date_edition = '2026-11-13'
   and i.code = 'NSBC'
   and not (i.metrics ? 'analyse');

-- Vérification : attendu 5 fiches, toutes du nouveau moteur.
-- select i.code, (i.metrics ? 'analyse') nouveau from public.hebdo_items i
--   join public.hebdo_editions e on e.id = i.edition_id where e.date_edition = '2026-11-13';
