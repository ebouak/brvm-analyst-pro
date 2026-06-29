-- 0059_academy_courses.sql
-- Cours générés par IA pour la WestBourse Academy.
-- Le contenu structuré (content jsonb) est produit par un LLM puis rendu en HTML
-- charté WESTBOURSE (html). On stocke les deux : content pour régénérer/éditer,
-- html pour servir directement (Vercel = FS lecture seule à l'exécution).

create table if not exists public.academy_courses (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  titre       text not null,
  niveau      text,                       -- debutant | intermediaire | avance | expert
  resume      text,
  content     jsonb not null,             -- { intro, lessons[], glossaire[] }
  html        text not null,              -- rendu charté (servi via /api/academy/[slug])
  published   boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists academy_courses_published_idx
  on public.academy_courses (published, created_at desc);

-- RLS : lecture publique des cours publiés ; écriture réservée au service_role
-- (les routes admin utilisent le service client après requirePermission).
alter table public.academy_courses enable row level security;

drop policy if exists academy_courses_public_read on public.academy_courses;
create policy academy_courses_public_read on public.academy_courses
  for select using (published = true);

comment on table public.academy_courses is
  'Cours WestBourse Academy générés par IA (contenu JSON + HTML charté). RGPD: aucune donnée personnelle.';
