-- ============================================================================
-- 0112_academy_exams_certificats.sql
-- Examens de niveau + certificats partageables.
-- Spec : docs/superpowers/specs/2026-07-21-academy-examens-certificats-design.md
-- ============================================================================

-- 1) Banque de questions — JAMAIS lisible (assemblée serveur-only via service_role).
create table if not exists public.academy_exam_questions (
  id           uuid primary key default gen_random_uuid(),
  niveau       text not null check (niveau in ('debutant','intermediaire','avance','expert')),
  question     text not null,
  options      jsonb not null,
  correct      integer not null check (correct >= 0),
  explication  text not null,
  source       text not null check (source in ('quiz','inedite')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_exam_questions_niveau on public.academy_exam_questions (niveau) where active;
alter table public.academy_exam_questions enable row level security;
-- Aucune policy de lecture : personne (anon/authenticated) ne lit cette table.
revoke insert, update, delete on public.academy_exam_questions from public, anon, authenticated;

-- 2) Passages d'examen — RLS owner-strict.
create table if not exists public.academy_exam_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  niveau       text not null check (niveau in ('debutant','intermediaire','avance','expert')),
  question_ids uuid[] not null,
  score        integer not null check (score between 0 and 100),
  passed       boolean not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_exam_attempts_user on public.academy_exam_attempts (user_id, niveau, created_at desc);
alter table public.academy_exam_attempts enable row level security;
drop policy if exists "exam_attempts owner select" on public.academy_exam_attempts;
create policy "exam_attempts owner select" on public.academy_exam_attempts
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "exam_attempts owner insert" on public.academy_exam_attempts;
create policy "exam_attempts owner insert" on public.academy_exam_attempts
  for insert to authenticated with check (user_id = (select auth.uid()));

-- 3) Certificats. Lecture publique des certificats NON révoqués, colonnes sûres
--    uniquement (user_id et consent_at ne sont JAMAIS exposés — grants de
--    colonnes). Toute écriture et toute lecture-propriétaire passe par le
--    service_role côté serveur (routes), l'appartenance vérifiée en code.
create table if not exists public.academy_certificates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  niveau        text not null check (niveau in ('debutant','intermediaire','avance','expert')),
  display_name  text not null,
  consent_at    timestamptz not null,
  issued_at     timestamptz not null default now(),
  revoked       boolean not null default false,
  unique (user_id, niveau)
);
alter table public.academy_certificates enable row level security;

-- Colonnes lisibles par anon/authenticated : jamais user_id ni consent_at.
revoke select on public.academy_certificates from anon, authenticated;
grant select (id, niveau, display_name, issued_at, revoked)
  on public.academy_certificates to anon, authenticated;

-- Seuls les certificats actifs sont lisibles (par tous).
drop policy if exists "certificates public read" on public.academy_certificates;
create policy "certificates public read" on public.academy_certificates
  for select using (revoked = false);

-- Vue de confort (security_invoker) : la sécurité est portée par la policy +
-- les grants de colonnes ci-dessus ; la vue ne projette que les colonnes sûres.
drop view if exists public.academy_certificates_public;
create view public.academy_certificates_public
  with (security_invoker = true) as
  select id, niveau, display_name, issued_at
  from public.academy_certificates
  where revoked = false;
grant select on public.academy_certificates_public to anon, authenticated;

comment on table public.academy_certificates is
  'Certificats de niveau Academy. Donnée perso (display_name) exposée publiquement SUR CONSENTEMENT (consent_at), via la vue academy_certificates_public (sans user_id). Révocable.';
