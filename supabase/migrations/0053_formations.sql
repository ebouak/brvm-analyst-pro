-- ============================================================================
-- 0053_formations.sql — Espace formations & conférences (réservé Premium).
-- Le contenu (replay, support) ne doit JAMAIS fuiter aux non-premium : la table
-- n'a AUCUNE policy de lecture publique → accessible uniquement au service_role.
-- Le catalogue public et la page premium lisent côté serveur (service client),
-- en exposant les colonnes sensibles seulement après vérification is_premium.
-- ============================================================================

create table if not exists public.formations (
  id            uuid primary key default gen_random_uuid(),
  titre         text not null,
  description   text,
  type          text not null default 'cours' check (type in ('cours', 'conference', 'webinaire')),
  niveau        text check (niveau in ('debutant', 'intermediaire', 'avance')),
  date_evenement date,            -- pour conférences/webinaires
  duree_min     int,
  cover_url     text,             -- visuel (public)
  replay_url    text,             -- vidéo / lien (PREMIUM)
  support_url   text,             -- PDF / ressources (PREMIUM)
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_formations_published on public.formations (published, date_evenement desc);

alter table public.formations enable row level security;
-- Aucune policy → lecture/écriture réservées au service_role (server-side).
