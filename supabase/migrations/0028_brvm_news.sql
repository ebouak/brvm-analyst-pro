-- supabase/migrations/0028_brvm_news.sql
create table if not exists public.brvm_news (
  id              uuid primary key default gen_random_uuid(),
  dedupe_hash     text unique not null,
  titre           text not null,
  date_publication date not null,
  source          text not null check (source in ('brvm','cosumaf','autre')),
  source_url      text,
  resume          text,
  instrument_code text references public.brvm_instruments(code) on update cascade,
  secteur         text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_brvm_news_date on public.brvm_news (date_publication desc);
create index if not exists idx_brvm_news_code on public.brvm_news (instrument_code);
alter table public.brvm_news enable row level security;
drop policy if exists "actualites publiques" on public.brvm_news;
create policy "actualites publiques" on public.brvm_news for select using (true);
