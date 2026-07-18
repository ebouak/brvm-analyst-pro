-- ============================================================================
-- 0110_academy_exercices.sql — Academy v2 P3 : résultat des exercices live.
-- Une colonne sur academy_progress (RLS owner déjà en place sur la table).
-- ============================================================================

alter table public.academy_progress
  add column if not exists exercice_passed boolean;

comment on column public.academy_progress.exercice_passed is
  'Résultat du dernier exercice live de la leçon (null = jamais tenté).';
