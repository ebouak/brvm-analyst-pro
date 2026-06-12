-- Publications déposées par les émetteurs sur BDFIN
create table if not exists public.publications (
  id              uuid        primary key default gen_random_uuid(),
  code            text        not null references public.brvm_instruments(code) on update cascade,
  date_publication date       not null,
  libelle         text        not null,
  type_publication text,
  source_url      text,
  source          text        not null default 'bdfin',
  dedupe_hash     text        unique,
  created_at      timestamptz not null default now()
);
create index if not exists idx_publications_code on public.publications (code, date_publication desc);
create index if not exists idx_publications_date on public.publications (date_publication desc);
alter table public.publications enable row level security;
drop policy if exists "lecture publique publications" on public.publications;
create policy "lecture publique publications" on public.publications for select using (true);
