-- ============================================================================
-- 0077_forum_212_redesign.sql
-- Forum redesign: 212 Trading style with pinned posts, trending algorithm,
-- award badges (💡🔥⭐), image galleries, nested replies, author profiles.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enhance forum_posts: images, pinning, trending score, nested replies
-- ---------------------------------------------------------------------------

alter table public.forum_posts
  add column if not exists image_urls jsonb not null default '[]'::jsonb,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists trending_score numeric(10,2) not null default 0.0;

comment on column public.forum_posts.image_urls is 'Array of up to 3 image URLs (jsonb). Stored as array of strings.';
comment on column public.forum_posts.is_pinned is 'True if post is pinned by moderator.';
comment on column public.forum_posts.pinned_at is 'Timestamp when post was pinned.';
comment on column public.forum_posts.trending_score is 'Computed hourly: reflects engagement (likes, awards, recency)';

-- Add index for trending score (used for sorting)
create index if not exists idx_forum_posts_trending_score
  on public.forum_posts (trending_score desc, is_pinned desc, created_at desc)
  where hidden = false;

-- Add index for pinned posts
create index if not exists idx_forum_posts_pinned
  on public.forum_posts (is_pinned desc, created_at desc)
  where is_pinned = true;

-- ---------------------------------------------------------------------------
-- 1b. Enhance forum_replies: add images and nested reply support
-- ---------------------------------------------------------------------------

alter table public.forum_replies
  add column if not exists image_urls jsonb not null default '[]'::jsonb,
  add column if not exists parent_reply_id uuid references public.forum_replies(id) on delete cascade;

comment on column public.forum_replies.image_urls is 'Array of up to 3 image URLs (jsonb).';
comment on column public.forum_replies.parent_reply_id is 'For nested replies: UUID of parent forum_reply (null for root replies to post).';

-- Index for nested reply lookups
create index if not exists idx_forum_replies_parent_reply
  on public.forum_replies (parent_reply_id)
  where parent_reply_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Create author_profiles: reputation, verification, avatar
-- ---------------------------------------------------------------------------

create table if not exists public.author_profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  avatar_url     text,
  display_name   text,
  is_verified    boolean not null default false,
  reputation_score integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.author_profiles is '212 Trading style author profiles with reputation and verification.';
comment on column public.author_profiles.avatar_url is 'Profile picture URL.';
comment on column public.author_profiles.display_name is 'Public display name (pseudonym, not real name for RGPD).';
comment on column public.author_profiles.is_verified is 'True if user is verified (influencer/expert).';
comment on column public.author_profiles.reputation_score is 'Accumulated from awards received on forum posts.';

create index if not exists idx_author_profiles_verified
  on public.author_profiles (is_verified)
  where is_verified = true;

create index if not exists idx_author_profiles_reputation
  on public.author_profiles (reputation_score desc);

alter table public.author_profiles enable row level security;

-- Public read: profile info is public (no emails, just avatar/display_name/verification)
drop policy if exists "author_profiles_public_read" on public.author_profiles;
create policy "author_profiles_public_read"
  on public.author_profiles for select using (true);

-- Owner can update own profile
drop policy if exists "author_profiles_owner_update" on public.author_profiles;
create policy "author_profiles_owner_update"
  on public.author_profiles for update using (auth.uid() = user_id);

-- Owner can delete own profile (cascades to auth.users)
drop policy if exists "author_profiles_owner_delete" on public.author_profiles;
create policy "author_profiles_owner_delete"
  on public.author_profiles for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Create post_interactions: likes and awards (💡🔥⭐)
-- ---------------------------------------------------------------------------

create table if not exists public.post_interactions (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.forum_posts(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  interaction_type  text not null check (interaction_type in ('like', 'award')),
  award_type        text check (award_type is null or award_type in ('💡', '🔥', '⭐')),
  created_at        timestamptz not null default now(),
  -- Constraint: award_type is required if interaction_type = 'award'
  constraint check_award_type_required
    check ((interaction_type = 'like' and award_type is null)
           or (interaction_type = 'award' and award_type is not null))
);

comment on table public.post_interactions is 'Likes and award badges on forum posts. Supports 💡 (insight), 🔥 (hot), ⭐ (star).';
comment on column public.post_interactions.interaction_type is 'Type: "like" (simple upvote) or "award" (badge with emoji).';
comment on column public.post_interactions.award_type is 'Award emoji (💡, 🔥, ⭐). Null for likes. Drives reputation_score.';

-- Unique constraints: one like per user per post; one award of each type per user per post
create unique index if not exists idx_post_interactions_like_unique
  on public.post_interactions (post_id, user_id)
  where interaction_type = 'like';

create unique index if not exists idx_post_interactions_award_unique
  on public.post_interactions (post_id, user_id, award_type)
  where interaction_type = 'award';

-- Performance indexes
create index if not exists idx_post_interactions_post
  on public.post_interactions (post_id);

create index if not exists idx_post_interactions_user
  on public.post_interactions (user_id);

create index if not exists idx_post_interactions_award_type
  on public.post_interactions (award_type)
  where interaction_type = 'award' and award_type is not null;

alter table public.post_interactions enable row level security;

-- Public read: can see who liked/awarded which post (proof of value)
drop policy if exists "post_interactions_public_read" on public.post_interactions;
create policy "post_interactions_public_read"
  on public.post_interactions for select using (true);

-- User can add/remove own interaction
drop policy if exists "post_interactions_owner_write" on public.post_interactions;
create policy "post_interactions_owner_write"
  on public.post_interactions for insert with check (auth.uid() = user_id);

drop policy if exists "post_interactions_owner_delete" on public.post_interactions;
create policy "post_interactions_owner_delete"
  on public.post_interactions for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Create user_preferences: digest frequency, followed instruments, notifications
-- ---------------------------------------------------------------------------

create table if not exists public.user_preferences (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  email_digest_frequency    text not null default 'weekly'
    check (email_digest_frequency in ('daily', 'weekly', 'never')),
  followed_instruments      text[] not null default '{}',
  notify_replies            boolean not null default true,
  notify_likes              boolean not null default true,
  notify_awards             boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.user_preferences is 'User notification and forum preferences.';
comment on column public.user_preferences.email_digest_frequency is 'Frequency of digest emails: daily, weekly (default), or never.';
comment on column public.user_preferences.followed_instruments is 'Array of instrument codes to follow for forum notifications.';
comment on column public.user_preferences.notify_replies is 'Notify when someone replies to my post.';
comment on column public.user_preferences.notify_likes is 'Notify when someone likes my post.';
comment on column public.user_preferences.notify_awards is 'Notify when someone awards my post.';

create index if not exists idx_user_preferences_digest_frequency
  on public.user_preferences (email_digest_frequency);

alter table public.user_preferences enable row level security;

-- User can only read/write own preferences
drop policy if exists "user_preferences_owner_read" on public.user_preferences;
create policy "user_preferences_owner_read"
  on public.user_preferences for select using (auth.uid() = user_id);

drop policy if exists "user_preferences_owner_write" on public.user_preferences;
create policy "user_preferences_owner_write"
  on public.user_preferences for insert with check (auth.uid() = user_id);

drop policy if exists "user_preferences_owner_update" on public.user_preferences;
create policy "user_preferences_owner_update"
  on public.user_preferences for update using (auth.uid() = user_id);

drop policy if exists "user_preferences_owner_delete" on public.user_preferences;
create policy "user_preferences_owner_delete"
  on public.user_preferences for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Enhance forum_reports: reason enum and support for new schema
-- ---------------------------------------------------------------------------

-- Update forum_reports to support 'post' as target_type (already supports 'topic','post')
-- Reason check is already in place; we'll allow it to accept new reason types

alter table public.forum_reports
  add column if not exists resolution_notes text,
  add column if not exists resolved_by_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz;

comment on column public.forum_reports.reason is 'Reason: spam, inappropriate, misleading, or custom. Check constraint enforces enum.';
comment on column public.forum_reports.resolution_notes is 'Admin notes on how the report was resolved.';
comment on column public.forum_reports.resolved_by_admin_id is 'Admin user who resolved this report.';
comment on column public.forum_reports.resolved_at is 'Timestamp when report was marked resolved.';

-- Add index for post-specific reports
create index if not exists idx_forum_reports_post
  on public.forum_reports (target_id)
  where target_type = 'post' and resolved = false;

-- Add index for unresolved reports (admin dashboard)
create index if not exists idx_forum_reports_unresolved
  on public.forum_reports (created_at desc)
  where resolved = false;

-- ---------------------------------------------------------------------------
-- 6. Update forum_posts RLS to account for pinned post access
-- ---------------------------------------------------------------------------

-- Refresh forum_posts RLS to include logic for pinned posts (still public read)
-- Note: existing policies are sufficient; hidden = false already gates read access

-- ---------------------------------------------------------------------------
-- 7. Create trigger to auto-create author_profiles on forum post creation
-- ---------------------------------------------------------------------------

create or replace function public.ensure_author_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.author_profiles (user_id)
  values (new.author_id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_author_profile_on_post on public.forum_posts;
create trigger ensure_author_profile_on_post
  before insert on public.forum_posts
  for each row execute function public.ensure_author_profile();

-- ---------------------------------------------------------------------------
-- 8. Create trigger to update reputation when awards are added
-- ---------------------------------------------------------------------------

create or replace function public.update_reputation_on_award()
returns trigger language plpgsql security definer as $$
declare
  post_author_id uuid;
  award_points integer;
begin
  if new.interaction_type = 'award' and new.award_type is not null then
    -- Get the post author
    select author_id into post_author_id from public.forum_posts where id = new.post_id;

    if post_author_id is not null then
      -- Award points: 💡=1, 🔥=2, ⭐=3
      award_points := case
        when new.award_type = '💡' then 1
        when new.award_type = '🔥' then 2
        when new.award_type = '⭐' then 3
        else 0
      end;

      -- Increment reputation_score (create profile if needed)
      insert into public.author_profiles (user_id, reputation_score)
      values (post_author_id, award_points)
      on conflict (user_id) do update
      set reputation_score = author_profiles.reputation_score + award_points,
          updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists update_reputation_on_award on public.post_interactions;
create trigger update_reputation_on_award
  after insert on public.post_interactions
  for each row execute function public.update_reputation_on_award();

-- ---------------------------------------------------------------------------
-- 9. Create trigger to decrement reputation when awards are removed
-- ---------------------------------------------------------------------------

create or replace function public.decrement_reputation_on_award_remove()
returns trigger language plpgsql security definer as $$
declare
  post_author_id uuid;
  award_points integer;
begin
  if old.interaction_type = 'award' and old.award_type is not null then
    select author_id into post_author_id from public.forum_posts where id = old.post_id;

    if post_author_id is not null then
      award_points := case
        when old.award_type = '💡' then 1
        when old.award_type = '🔥' then 2
        when old.award_type = '⭐' then 3
        else 0
      end;

      update public.author_profiles
      set reputation_score = greatest(0, reputation_score - award_points),
          updated_at = now()
      where user_id = post_author_id;
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists decrement_reputation_on_award_remove on public.post_interactions;
create trigger decrement_reputation_on_award_remove
  before delete on public.post_interactions
  for each row execute function public.decrement_reputation_on_award_remove();

-- ---------------------------------------------------------------------------
-- 10. Create trigger to initialize user_preferences on signup
-- ---------------------------------------------------------------------------

create or replace function public.initialize_user_preferences()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists initialize_user_preferences on auth.users;
create trigger initialize_user_preferences
  after insert on auth.users
  for each row execute function public.initialize_user_preferences();

-- ============================================================================
-- End of migration 0077_forum_212_redesign.sql
-- ============================================================================
