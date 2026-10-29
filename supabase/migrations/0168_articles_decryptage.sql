-- 0168_articles_decryptage.sql — type d'article « décryptage » (thèse d'une valeur).
-- Généré depuis le dossier valeur, publié seulement après validation humaine.
alter table public.articles drop constraint if exists articles_type_check;
alter table public.articles add constraint articles_type_check check (type in (
  'dividende_annonce', 'detachement_rappel', 'paiement_rappel',
  'operation_titres', 'seance_hors_norme',
  'resultats', 'notation', 'theme_tendance', 'decryptage'));
