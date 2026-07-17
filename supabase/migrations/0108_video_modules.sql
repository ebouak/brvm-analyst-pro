-- ============================================================================
-- 0108_video_modules.sql — Modules vidéo interactifs (formations).
--
-- Cours vidéo multi-leçons + quiz par leçon + progression par utilisateur.
-- Distinct de `formations` (mono-vidéo premium) et `academy_courses` (texte IA).
--
-- RLS (discipline pentest 2026-07-09) :
--  - catalogue (courses/lessons/quizzes) : lecture pour les utilisateurs
--    AUTHENTIFIÉS uniquement (les modules sont derrière le mur d'auth) ; écriture
--    réservée au service_role. Pas de lecture anonyme.
--  - progression : RLS OWNER strict (chacun ne voit et n'écrit que ses lignes).
-- ============================================================================

-- ── Cours ────────────────────────────────────────────────────────────────
create table if not exists public.video_courses (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  titre       text not null,
  resume      text,
  niveau      text check (niveau in ('debutant', 'intermediaire', 'avance', 'expert')),
  cover_url   text,
  ordre       int not null default 0,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Leçons ───────────────────────────────────────────────────────────────
create table if not exists public.video_lessons (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.video_courses(id) on delete cascade,
  titre       text not null,
  -- provider : 'mp4' (lecteur natif interactif) | 'youtube' | 'vimeo' (embed).
  provider    text not null default 'mp4' check (provider in ('mp4', 'youtube', 'vimeo')),
  video_url   text not null,           -- URL MP4 (Supabase Storage/Mux) OU id/URL embed
  duree_s     int,
  ordre       int not null default 0,
  transcript  text,
  -- chapitres : [{ at_s: int, titre: text }] pour la navigation.
  chapters    jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  unique (course_id, ordre)
);
create index if not exists idx_video_lessons_course on public.video_lessons (course_id, ordre);

-- ── Quiz (une question, à un instant de la leçon) ──────────────────────────
create table if not exists public.video_quizzes (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.video_lessons(id) on delete cascade,
  at_second   int not null default 0,  -- 0 = à la fin de la leçon
  question    text not null,
  options     jsonb not null,          -- ["A", "B", "C"]
  correct_idx int not null,
  explication text,
  ordre       int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_video_quizzes_lesson on public.video_quizzes (lesson_id, ordre);

-- ── Progression par utilisateur ────────────────────────────────────────────
create table if not exists public.video_progress (
  user_id     uuid not null references auth.users(id) on delete cascade,
  lesson_id   uuid not null references public.video_lessons(id) on delete cascade,
  last_second int not null default 0,
  completed   boolean not null default false,
  completed_at timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists idx_video_progress_user on public.video_progress (user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.video_courses  enable row level security;
alter table public.video_lessons  enable row level security;
alter table public.video_quizzes  enable row level security;
alter table public.video_progress enable row level security;

-- Catalogue : lecture pour AUTHENTIFIÉS (jamais anon), écriture service_role.
drop policy if exists "lecture cours (auth)" on public.video_courses;
create policy "lecture cours (auth)" on public.video_courses
  for select to authenticated using (published = true);

drop policy if exists "lecture lecons (auth)" on public.video_lessons;
create policy "lecture lecons (auth)" on public.video_lessons
  for select to authenticated
  using (exists (select 1 from public.video_courses c where c.id = course_id and c.published));

drop policy if exists "lecture quiz (auth)" on public.video_quizzes;
create policy "lecture quiz (auth)" on public.video_quizzes
  for select to authenticated
  using (exists (
    select 1 from public.video_lessons l
    join public.video_courses c on c.id = l.course_id
    where l.id = lesson_id and c.published
  ));

-- Progression : chacun ne lit/écrit que SES lignes.
drop policy if exists "progression owner select" on public.video_progress;
create policy "progression owner select" on public.video_progress
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "progression owner upsert" on public.video_progress;
create policy "progression owner insert" on public.video_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "progression owner update" on public.video_progress
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Seed : 1 cours pilote (3 leçons + quiz) pour valider le flux ───────────
-- Vidéos = placeholders YouTube publics à remplacer par tes propres MP4/replays.
insert into public.video_courses (slug, titre, resume, niveau, ordre, published)
values ('bien-debuter-brvm', 'Bien débuter à la BRVM',
        'Les fondamentaux pour investir sereinement à la Bourse Régionale : comprendre le marché, lire une cotation, passer un premier ordre.',
        'debutant', 1, true)
on conflict (slug) do nothing;

do $$
declare c uuid; l1 uuid; l2 uuid; l3 uuid;
begin
  select id into c from public.video_courses where slug = 'bien-debuter-brvm';
  if c is null then return; end if;

  insert into public.video_lessons (course_id, titre, provider, video_url, duree_s, ordre, chapters)
  values
    (c, 'Qu''est-ce que la BRVM ?', 'youtube', 'dQw4w9WgXcQ', 360, 1,
     '[{"at_s":0,"titre":"Introduction"},{"at_s":90,"titre":"Les 8 pays de l''UEMOA"},{"at_s":210,"titre":"Actions vs obligations"}]'),
    (c, 'Lire une cotation', 'youtube', 'dQw4w9WgXcQ', 420, 2,
     '[{"at_s":0,"titre":"Le carnet d''ordres"},{"at_s":120,"titre":"Cours, veille, variation"}]'),
    (c, 'Passer son premier ordre', 'youtube', 'dQw4w9WgXcQ', 300, 3,
     '[{"at_s":0,"titre":"Choisir une SGI"},{"at_s":100,"titre":"Ordre au marché / à cours limité"}]')
  on conflict (course_id, ordre) do nothing;

  select id into l1 from public.video_lessons where course_id = c and ordre = 1;
  select id into l2 from public.video_lessons where course_id = c and ordre = 2;
  select id into l3 from public.video_lessons where course_id = c and ordre = 3;

  insert into public.video_quizzes (lesson_id, at_second, question, options, correct_idx, explication, ordre)
  values
    (l1, 0, 'Que signifie BRVM ?',
     '["Bourse Régionale des Valeurs Mobilières","Banque Régionale des Valeurs Monétaires","Bureau Régional de la Vente de Monnaie"]'::jsonb,
     0, 'La BRVM est la bourse commune aux 8 pays de l''UEMOA, basée à Abidjan.', 1),
    (l2, 0, 'Que représente la « veille » sur une cotation ?',
     '["Le cours d''ouverture du jour","Le cours de clôture de la séance précédente","Le plus haut de l''année"]'::jsonb,
     1, 'La veille est le dernier cours de la séance précédente ; la variation se calcule par rapport à elle.', 1),
    (l3, 0, 'Par qui passe-t-on obligatoirement un ordre à la BRVM ?',
     '["Directement en ligne","Par une SGI agréée","Par sa banque uniquement"]'::jsonb,
     1, 'Seules les SGI (Sociétés de Gestion et d''Intermédiation) agréées peuvent transmettre des ordres.', 1)
  on conflict do nothing;
end $$;
