-- ============================================================================
-- 0113_hebdo_analyses.sql
-- Analyse hebdomadaire des valeurs en vogue.
-- Spec : docs/superpowers/specs/2026-07-22-analyse-hebdo-valeurs-design.md
-- Le snapshot `metrics` fige les séries au moment de la publication : la page
-- reste stable et citable même si brvm_actions_daily évolue ensuite.
-- ============================================================================

create table if not exists public.hebdo_editions (
  id            uuid primary key default gen_random_uuid(),
  date_edition  date not null unique,
  statut        text not null default 'brouillon' check (statut in ('brouillon','publie')),
  auto          boolean not null default true,
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists idx_hebdo_editions_pub on public.hebdo_editions (statut, date_edition desc);

create table if not exists public.hebdo_items (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null references public.hebdo_editions(id) on delete cascade,
  code         text not null,
  sens         text not null check (sens in ('hausse','baisse')),
  raison       text not null default '',
  metrics      jsonb not null,
  narratif_md  text not null default '',
  ordre        integer not null default 0,
  unique (edition_id, code)
);
create index if not exists idx_hebdo_items_edition on public.hebdo_items (edition_id, ordre);

alter table public.hebdo_editions enable row level security;
alter table public.hebdo_items    enable row level security;

-- Lecture publique des éditions PUBLIÉES uniquement (les brouillons restent privés).
drop policy if exists "hebdo_editions public read" on public.hebdo_editions;
create policy "hebdo_editions public read" on public.hebdo_editions
  for select using (statut = 'publie');

-- Un item n'est lisible que si son édition est publiée.
drop policy if exists "hebdo_items public read" on public.hebdo_items;
create policy "hebdo_items public read" on public.hebdo_items
  for select using (
    exists (select 1 from public.hebdo_editions e where e.id = edition_id and e.statut = 'publie')
  );

-- Toute écriture passe par le service_role (worker + routes admin).
revoke insert, update, delete on public.hebdo_editions from public, anon, authenticated;
revoke insert, update, delete on public.hebdo_items    from public, anon, authenticated;

comment on table public.hebdo_editions is
  'Éditions hebdomadaires d''analyse technique BRVM. Lecture publique des éditions publiées ; écriture service_role (worker hebdo + admin). Aucune donnée personnelle.';
