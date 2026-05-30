-- Migration 0011 : table push_subscriptions pour Web Push notifications

create table if not exists public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "user reads own subs"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "user inserts own subs"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user deletes own subs"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());
