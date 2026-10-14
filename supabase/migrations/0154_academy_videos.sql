-- ============================================================================
-- 0154_academy_videos.sql
-- Vidéos motion design des leçons de l'Academy (rendu remotion/academy-lecon).
--
-- Bucket PRIVÉ, sans aucune policy : ni anon ni authenticated n'y lisent.
-- Seule la route /api/academy/video/[slug]/[fichier] (service_role) y signe
-- une URL de courte durée, APRÈS avoir vérifié que la personne peut suivre le
-- niveau du cours (abonnement ou achat Chariow) — la même règle que le texte
-- de la leçon. Un bucket public aurait ouvert la vidéo payante à qui connaît
-- l'adresse.
--
-- Chemins : <slug du cours>/lecon-<n>.mp4 (+ .jpg, image d'affiche).
-- 50 Mo par fichier : plafond d'envoi du palier Supabase ; la vidéo est
-- encodée pour le web (remotion/academy-publie.mjs) afin d'y tenir.
--
-- RGPD : aucune donnée personnelle (contenu pédagogique).
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academy-videos', 'academy-videos', false, 52428800, array['video/mp4', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
