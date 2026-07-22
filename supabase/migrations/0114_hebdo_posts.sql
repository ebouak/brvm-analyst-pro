-- ============================================================================
-- 0114_hebdo_posts.sql
-- Deux formats prêts à poster, stockés avec l'item hebdo.
-- Spec : docs/superpowers/specs/2026-07-22-hebdo-v2-vulgarisation-design.md
-- RLS inchangée : héritée de hebdo_items (lecture publique si édition publiée).
-- ============================================================================

alter table public.hebdo_items
  add column if not exists post_long  text not null default '',
  add column if not exists post_court text not null default '';

comment on column public.hebdo_items.post_long is
  'Post prêt à publier (LinkedIn/Facebook), généré depuis le squelette validé.';
comment on column public.hebdo_items.post_court is
  'Post prêt à publier (WhatsApp/Telegram), format condensé avec émojis.';

NOTIFY pgrst, 'reload schema';
