-- ============================================================================
-- 0056_profile_fields.sql — Champs de profil utilisateur (page /profil).
-- Ajoute les colonnes éditables. PAS de policy UPDATE owner : les écritures
-- passent par l'API server-side (service_role) sur des champs WHITELISTÉS
-- uniquement → is_premium reste NON modifiable par l'utilisateur (anti-escalade).
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_url       text,
  add column if not exists username         text,
  add column if not exists bio              text,
  add column if not exists location         text,
  add column if not exists experience_level text
    check (experience_level in ('beginner', 'intermediate', 'advanced', 'professional')),
  add column if not exists favorite_sectors text[] not null default '{}',
  add column if not exists cover_gradient   text,
  add column if not exists preferences      jsonb not null default '{}'::jsonb;

-- Aucune nouvelle policy : la lecture OWNER existante (auth.uid() = id) suffit
-- (le profil et son avatar sont lus via la session de l'utilisateur lui-même).
-- On NE rend PAS profiles public → l'email reste protégé. is_premium reste en
-- lecture seule (écritures profil via API server-side, champs whitelistés).
