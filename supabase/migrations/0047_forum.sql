-- supabase/migrations/0047_forum.sql
-- Forum de discussion (additif). RLS lecture publique (convention 0044).
-- Anonymisation RGPD : author_id ... on delete set null → la suppression du
-- compte auth.users nullifie automatiquement l'auteur (« Utilisateur supprimé »).

-- Pseudonyme d'affichage (jamais le nom réel ni l'email). Minimisation RGPD.
alter table public.profiles add column if not exists display_name text;

create table if not exists public.forum_topics (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid references auth.users(id) on delete set null,
  title            text not null,
  body             text not null,
  instrument_code  text references public.brvm_instruments(code) on update cascade,
  event_id         uuid references public.market_events(id) on delete set null,
  hidden           boolean not null default false,
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  constraint forum_topic_single_link check (instrument_code is null or event_id is null)
);
create index if not exists idx_forum_topics_instrument on public.forum_topics (instrument_code) where instrument_code is not null;
create index if not exists idx_forum_topics_event on public.forum_topics (event_id) where event_id is not null;
create index if not exists idx_forum_topics_activity on public.forum_topics (last_activity_at desc) where hidden = false;
create index if not exists idx_forum_topics_author on public.forum_topics (author_id);

create table if not exists public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.forum_topics(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body       text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index if not exists idx_forum_posts_topic on public.forum_posts (topic_id, created_at) where hidden = false;
create index if not exists idx_forum_posts_author on public.forum_posts (author_id);

create table if not exists public.forum_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('topic','post')),
  target_id   uuid not null,
  reason      text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_forum_reports_open on public.forum_reports (created_at desc) where resolved = false;

alter table public.forum_topics  enable row level security;
alter table public.forum_posts   enable row level security;
alter table public.forum_reports enable row level security;

drop policy if exists "forum_topics_public_read" on public.forum_topics;
create policy "forum_topics_public_read" on public.forum_topics for select using (hidden = false);
drop policy if exists "forum_posts_public_read" on public.forum_posts;
create policy "forum_posts_public_read" on public.forum_posts for select using (hidden = false);

drop policy if exists "forum_topics_insert" on public.forum_topics;
create policy "forum_topics_insert" on public.forum_topics for insert with check (auth.uid() = author_id);
drop policy if exists "forum_posts_insert" on public.forum_posts;
create policy "forum_posts_insert" on public.forum_posts for insert with check (auth.uid() = author_id);

drop policy if exists "forum_topics_owner_update" on public.forum_topics;
create policy "forum_topics_owner_update" on public.forum_topics for update using (auth.uid() = author_id);
drop policy if exists "forum_topics_owner_delete" on public.forum_topics;
create policy "forum_topics_owner_delete" on public.forum_topics for delete using (auth.uid() = author_id);
drop policy if exists "forum_posts_owner_update" on public.forum_posts;
create policy "forum_posts_owner_update" on public.forum_posts for update using (auth.uid() = author_id);
drop policy if exists "forum_posts_owner_delete" on public.forum_posts;
create policy "forum_posts_owner_delete" on public.forum_posts for delete using (auth.uid() = author_id);

drop policy if exists "forum_reports_insert" on public.forum_reports;
create policy "forum_reports_insert" on public.forum_reports for insert with check (auth.uid() = reporter_id);
-- Pas de policy select sur forum_reports → lecture réservée au service_role (admin).
