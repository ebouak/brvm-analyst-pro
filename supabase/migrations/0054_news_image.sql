-- ============================================================================
-- 0054_news_image.sql — Illustration (og:image) des actualités.
-- Le scraper brvm.org extrait l'og:image de chaque article ; stockée ici pour
-- afficher une vignette dans le fil /actualites. Colonne optionnelle (null si
-- l'article n'expose pas d'image).
-- ============================================================================

alter table public.brvm_news
  add column if not exists image_url text;
