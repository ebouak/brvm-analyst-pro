-- ============================================================================
-- 0197 — Replay « 5 étapes » : titre nettoyé, description qui répétait le titre
-- ============================================================================
-- Constat (2026-11-07) : formations.id b8cc0b74-… avait description = titre
-- mot pour mot (doubles espaces compris), affiché deux fois sur /formations.
-- La page n'affiche la description que si elle est non nulle
-- (app/formations/page.tsx:230, sessions/[id]:42) et la colonne est nullable :
-- on la vide plutôt que d'inventer un texte.
-- Les libellés « Débutant / Intermédiaire / Avancé » viennent d'une table de
-- correspondance du code (NIVEAU_LABEL) ; les valeurs de formations.niveau et
-- academy_courses.niveau sont des identifiants techniques (accès, tri) : on
-- n'y touche pas. Aucune donnée personnelle.
-- ============================================================================

update public.formations
   set titre = btrim(regexp_replace(titre, '\s+', ' ', 'g')),
       description = null
 where id = 'b8cc0b74-bbd4-49ec-b797-e1763558b915'
   and (description is null
        or btrim(regexp_replace(description, '\s+', ' ', 'g')) = btrim(regexp_replace(titre, '\s+', ' ', 'g')));
