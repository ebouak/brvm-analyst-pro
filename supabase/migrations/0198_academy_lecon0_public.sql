-- ============================================================================
-- 0198 — Bucket PUBLIC dédié à la Leçon 0 (gratuite, ouverte à tous)
-- ============================================================================
-- Constat (2026-11-07) : lib/academy/lecon0.ts pointait vers
-- /storage/v1/object/public/academy-videos/…, or ce bucket est PRIVÉ depuis
-- 0154 (volontairement : vidéos payantes servies par URL signée). L'URL
-- publique répond « Bucket not found ». Le bucket existe et contient bien
-- ecosysteme-umoa.mp4 (15,5 Mo), -poster.jpg et ecosysteme-umoa.jpg.
-- Correction : un bucket public distinct, réservé à ces trois fichiers
-- gratuits. academy-videos n'est PAS modifié (ni bucket, ni politiques).
-- Lecture publique d'un bucket public : pas de policy storage.objects requise.
-- Aucune donnée personnelle.
--
-- ÉTAPE MANUELLE après application : copier les 3 objets (SQL ne peut pas
-- déplacer le contenu). Depuis frontend/ avec la clé secrète :
--   télécharger via URL signée de academy-videos, puis les téléverser dans
--   academy-lecon0 sous les mêmes noms. Ne rien supprimer dans academy-videos
--   tant que /formations/academy/lecon-0 n'est pas vérifiée.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academy-lecon0', 'academy-lecon0', true, 31457280, array['video/mp4', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
