-- ============================================================================
-- 0109_academy_progress.sql — Academy v2 P1 : progression + notes personnelles.
-- RLS OWNER strict (discipline pentest 2026-07-09) : chacun ne lit/écrit que
-- ses lignes ; aucune lecture anonyme. Les tables examens/certificats/codes
-- arrivent dans les phases 2 et 4 (migrations suivantes).
-- ============================================================================

create table if not exists public.academy_progress (
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   uuid not null references public.academy_courses(id) on delete cascade,
  lesson_idx  int  not null check (lesson_idx >= 0),
  completed   boolean not null default false,
  quiz_score  int check (quiz_score between 0 and 100),
  quiz_passed boolean,
  updated_at  timestamptz not null default now(),
  primary key (user_id, course_id, lesson_idx)
);
create index if not exists idx_academy_progress_user on public.academy_progress (user_id, updated_at desc);

create table if not exists public.academy_notes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   uuid not null references public.academy_courses(id) on delete cascade,
  lesson_idx  int  not null check (lesson_idx >= 0),
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, course_id, lesson_idx)
);

alter table public.academy_progress enable row level security;
alter table public.academy_notes    enable row level security;

drop policy if exists "academy_progress owner select" on public.academy_progress;
create policy "academy_progress owner select" on public.academy_progress
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "academy_progress owner insert" on public.academy_progress;
create policy "academy_progress owner insert" on public.academy_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "academy_progress owner update" on public.academy_progress;
create policy "academy_progress owner update" on public.academy_progress
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "academy_notes owner select" on public.academy_notes;
create policy "academy_notes owner select" on public.academy_notes
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "academy_notes owner insert" on public.academy_notes;
create policy "academy_notes owner insert" on public.academy_notes
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "academy_notes owner update" on public.academy_notes;
create policy "academy_notes owner update" on public.academy_notes
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "academy_notes owner delete" on public.academy_notes;
create policy "academy_notes owner delete" on public.academy_notes
  for delete to authenticated using (user_id = (select auth.uid()));

comment on table public.academy_progress is
  'Progression Academy par utilisateur/leçon. RGPD: donnée pédagogique liée au compte, supprimée en cascade avec le compte.';
comment on table public.academy_notes is
  'Notes personnelles Academy. RGPD: contenu utilisateur privé (RLS owner), supprimé en cascade avec le compte.';
