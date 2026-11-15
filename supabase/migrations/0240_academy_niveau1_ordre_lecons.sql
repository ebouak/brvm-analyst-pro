-- 0240 — Academy, niveau 1 : la leçon « compte et ordre » passe avant les risques (2026-11-15).
--
-- Demande de l'exploitant : la leçon 9 « Ouvrir un compte et passer son premier
-- ordre » venait après la leçon 6 « Les risques », qui détaille déjà les ordres
-- selon le règlement de la BRVM. Elle est déplacée en position 6.
--
-- Nouvel ordre (index 0-basés de content.lessons) :
--   ancien 8 (compte et ordre) → 5 ; anciens 5, 6, 7 → 6, 7, 8 ;
--   0-4, 9 et 10 ne bougent pas.
-- Source : frontend/lib/academy/contenus/lecon6-compte-ordre.json,
--          lecon7-risques.json, lecon8-scolarite.json, lecon9-strategies.json.
--
-- MÉTHODE. Le tableau `lessons` est reconstruit EN SQL à partir de lui-même :
-- aucun contenu n'est recopié en dur (0237 et 0238 l'ont modifié en base). Puis,
-- par jsonb_set ciblé : le numéro « Leçon N — » des quatre leçons déplacées (le
-- reste du titre est conservé tel quel), et les deux renvois croisés :
--   · leçon 6 (compte et ordre), section « Deux types d’ordres » :
--     « Le détail des règles (validité, tout ou rien) est en leçon 6. »
--     → « La leçon 7 y ajoute la durée de validité et le « tout ou rien », puis
--        met ces règles en pratique sur un carnet d’ordres. »
--   · leçon 7 (risques), section « Les ordres de bourse selon les règles de la
--     BRVM » : le premier paragraphe renvoie désormais à la leçon 6 au lieu de
--     présenter les deux limites de prix comme nouvelles.
-- Chaque section est retrouvée par son titre, jamais par sa position.
--
-- PROGRESSION. academy_progress et academy_notes sont indexées par position
-- (lesson_idx) : elles sont remappées par la même permutation, pour ce cours
-- seulement, en passant par un décalage temporaire (+1000) pour ne jamais
-- violer la clé primaire (user_id, course_id, lesson_idx). Au 2026-11-15 :
-- progression aux index 0-5 et 8-10, aucune note.
--
-- VIDÉOS. Bucket privé `academy-videos`, fichiers <slug>/lecon-<n>.mp4|.jpg
-- (1-indexés, frontend/lib/academy/videos.ts). Au 2026-11-15, seules les
-- leçons 1 à 5 du niveau 1 ont une vidéo : aucune leçon déplacée (6 à 9) n'en
-- a, donc AUCUN fichier n'est à renommer. À revérifier avant application :
--   select name from storage.objects
--    where bucket_id = 'academy-videos' and name like 'academy-niveau-1-initiation/%';
-- Si une vidéo lecon-6..9 existait, il faudrait la renommer selon la même
-- permutation (9 → 6, 6 → 7, 7 → 8, 8 → 9), hors de cette migration.
--
-- IDEMPOTENCE. La garde n'agit que si l'index 5 porte encore le titre de
-- l'ancienne leçon 6 (risques) ET l'index 8 celui de l'ancienne leçon 9 :
-- un second passage ne fait rien (notice). Tout se fait dans une transaction.
--
-- ⚠️ ORDRE : APRÈS 0234 à 0238 (déjà appliquées). Ces migrations visent les
-- leçons par position ET par titre : rejouées après 0240, leurs gardes de titre
-- échouent et elles ne touchent rien — sauf 0237, qui fusionne des leçons
-- entières par position et ne doit plus être rejouée.
-- Aucun schéma ne change : pas de dépendance au déploiement du frontend (le
-- site lit le contenu en base ; les JSON du dépôt n'en sont que la source).
-- Aucune donnée personnelle ajoutée ; les lignes de progression sont seulement
-- renumérotées.

begin;

do $do$
declare
  v_id uuid;
  v_lecons jsonb;
  v_idx int;
  v_n int;
  v_ancien text;
  v_nouveau text;
begin
  select id, content->'lessons' into v_id, v_lecons
    from public.academy_courses
   where slug = 'academy-niveau-1-initiation'
     and content->'lessons'->5->>'titre' in (
           $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$,
           $wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$)
     and content->'lessons'->8->>'titre' = $wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$
   for update;

  if v_id is null then
    raise notice '0240 : ordre déjà appliqué (ou cours introuvable), rien à faire';
    return;
  end if;

  -- 1. Réordonner : nouvelle position = f(ancienne position).
  select jsonb_agg(e.v order by case (e.o - 1)::int
                                  when 8 then 5 when 5 then 6 when 6 then 7 when 7 then 8
                                  else (e.o - 1)::int end)
    into v_lecons
    from jsonb_array_elements(v_lecons) with ordinality as e(v, o);

  -- 2. Renuméroter « Leçon N — » des leçons désormais en positions 5 à 8.
  for v_idx in 5..8 loop
    v_lecons := jsonb_set(
      v_lecons, array[v_idx::text, 'titre'],
      to_jsonb(regexp_replace(v_lecons->v_idx->>'titre', '^Leçon [0-9]+ — ', 'Leçon ' || (v_idx + 1) || ' — ')));
  end loop;

  -- 3a. Renvoi de la leçon 6 (compte et ordre) vers la leçon 7.
  v_ancien  := $wb$Le détail des règles (validité, tout ou rien) est en leçon 6.$wb$;
  v_nouveau := $wb$La leçon 7 y ajoute la durée de validité et le « tout ou rien », puis met ces règles en pratique sur un carnet d’ordres.$wb$;
  select (e.o - 1)::int into v_n
    from jsonb_array_elements(v_lecons->5->'sections') with ordinality as e(v, o)
   where e.v->>'titre' in ($wb$Deux types d’ordres$wb$, $wb$Deux types d'ordres$wb$)
     and strpos(e.v->>'contenu', v_ancien) > 0;
  if v_n is not null then
    v_lecons := jsonb_set(v_lecons, array['5', 'sections', v_n::text, 'contenu'],
      to_jsonb(replace(v_lecons->5->'sections'->v_n->>'contenu', v_ancien, v_nouveau)));
  else
    raise notice '0240 : renvoi de la leçon 6 introuvable (texte différent en base), laissé tel quel';
  end if;

  -- 3b. Leçon 7 (risques) : le premier paragraphe renvoie à la leçon 6.
  v_n := null;
  v_ancien  := $wb$Choisir une bonne action ne suffit pas : un ordre mal rédigé peut faire payer trop cher, ou ne jamais s’exécuter. Le règlement général de la BRVM décrit un ordre par trois caractéristiques$wb$;
  v_nouveau := 'Un ordre mal rédigé peut faire payer trop cher, ou ne jamais s’exécuter. La leçon 6 a présenté les deux limites de prix : au mieux et à cours limité.'
               || E'\n' || 'Le règlement général de la BRVM décrit un ordre par trois caractéristiques';
  select (e.o - 1)::int into v_n
    from jsonb_array_elements(v_lecons->6->'sections') with ordinality as e(v, o)
   where e.v->>'titre' = $wb$Les ordres de bourse selon les règles de la BRVM$wb$
     and strpos(e.v->>'contenu', v_ancien) > 0;
  if v_n is not null then
    v_lecons := jsonb_set(v_lecons, array['6', 'sections', v_n::text, 'contenu'],
      to_jsonb(replace(v_lecons->6->'sections'->v_n->>'contenu', v_ancien, v_nouveau)));
  else
    raise notice '0240 : premier paragraphe des ordres (leçon 7) introuvable, laissé tel quel';
  end if;

  update public.academy_courses
     set content = jsonb_set(content, '{lessons}', v_lecons),
         updated_at = now()
   where id = v_id;

  -- 4. Progression et notes : même permutation, par décalage temporaire.
  update public.academy_progress set lesson_idx = lesson_idx + 1000
   where course_id = v_id and lesson_idx between 5 and 8;
  update public.academy_progress
     set lesson_idx = case lesson_idx - 1000 when 8 then 5 when 5 then 6 when 6 then 7 when 7 then 8 end
   where course_id = v_id and lesson_idx between 1005 and 1008;

  update public.academy_notes set lesson_idx = lesson_idx + 1000
   where course_id = v_id and lesson_idx between 5 and 8;
  update public.academy_notes
     set lesson_idx = case lesson_idx - 1000 when 8 then 5 when 5 then 6 when 6 then 7 when 7 then 8 end
   where course_id = v_id and lesson_idx between 1005 and 1008;

  raise notice '0240 : leçons du niveau 1 réordonnées, progression et notes remappées';
end
$do$;

commit;

-- Vérification après application : 11 leçons, titres numérotés 1 à 11 dans
-- l'ordre, « compte et ordre » en 6 et « risques » en 7, renvois en place,
-- aucune progression restée sur un index décalé.
-- select (e.o - 1) as idx, e.v->>'titre' as titre
--   from public.academy_courses c,
--        jsonb_array_elements(c.content->'lessons') with ordinality as e(v, o)
--  where c.slug = 'academy-niveau-1-initiation' order by e.o;
-- select c.content::text like '%La leçon 7 y ajoute la durée de validité%' as renvoi_l6,
--        c.content::text like '%La leçon 6 a présenté les deux limites de prix%' as renvoi_l7,
--        c.content::text like '%est en leçon 6.%' as ancien_renvoi
--   from public.academy_courses c where c.slug = 'academy-niveau-1-initiation';
-- select lesson_idx, count(*) from public.academy_progress p
--   join public.academy_courses c on c.id = p.course_id
--  where c.slug = 'academy-niveau-1-initiation' group by 1 order by 1;
