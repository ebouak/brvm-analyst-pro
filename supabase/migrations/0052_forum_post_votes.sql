-- ============================================================================
-- 0052_forum_post_votes.sql — Votes (upvotes) sur les réponses du forum.
-- Levier d'engagement : preuve sociale + mise en avant des contributions utiles.
-- Lecture publique (comptage) ; écriture réservée au propriétaire du vote.
-- ============================================================================

create table if not exists public.forum_post_votes (
  post_id    uuid not null references public.forum_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists idx_forum_votes_post on public.forum_post_votes (post_id);

alter table public.forum_post_votes enable row level security;

drop policy if exists "votes_public_read" on public.forum_post_votes;
create policy "votes_public_read" on public.forum_post_votes for select using (true);

drop policy if exists "votes_owner_write" on public.forum_post_votes;
create policy "votes_owner_write" on public.forum_post_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists "votes_owner_delete" on public.forum_post_votes;
create policy "votes_owner_delete" on public.forum_post_votes
  for delete using (auth.uid() = user_id);
