-- Conseiller : position de chaque valeur par famille de facteurs, SANS verdict.
-- Spec docs/superpowers/specs/2026-11-09-conseiller-v2-design.md §12.
-- Données de marché uniquement : aucune donnée personnelle.
create table if not exists public.conseiller_facteurs (
  date_marche      date        not null,
  code             text        not null references public.brvm_instruments(code) on update cascade,
  scores           jsonb       not null,
  tiers            jsonb       not null,
  effectifs        jsonb       not null,
  classe_liquidite text        check (classe_liquidite in ('A','B','C','D')),
  moteur_version   text        not null,
  created_at       timestamptz not null default now(),
  primary key (date_marche, code)
);
create index if not exists idx_conseiller_facteurs_date on public.conseiller_facteurs (date_marche desc);

alter table public.conseiller_facteurs enable row level security;
drop policy if exists "lecture publique conseiller_facteurs" on public.conseiller_facteurs;
create policy "lecture publique conseiller_facteurs" on public.conseiller_facteurs
  for select to anon, authenticated using (true);
-- Écriture : service_role seulement (aucune policy d'écriture).
revoke insert, update, delete on public.conseiller_facteurs from anon, authenticated;
