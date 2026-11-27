-- ============================================================================
-- 0279_stress_daily_index.sql
-- Phase 4 du module BRVM Market Stress Monitor : Indice quotidien de stress (0-100).
--
-- Thermomètre descriptif contemporain de la tension du marché BRVM dérivé
-- exclusivement des clôtures quotidiennes (aucune donnée utilisateur, aucun
-- signal directionnel d'achat/vente).
-- Lecture publique (anon, authenticated), écriture réservée au service_role.
-- ============================================================================

create table if not exists public.stress_daily_index (
  date_marche                date primary key,
  stress_index               numeric(6,2) not null check (stress_index >= 0 and stress_index <= 100),
  regime                     text not null check (
    regime in ('faible_tension', 'tension_moderee', 'tension_elevee', 'tension_extreme')
  ),
  couverture_composantes_pct numeric(6,2) not null check (couverture_composantes_pct >= 0 and couverture_composantes_pct <= 100),
  nb_composantes_actives     integer not null check (nb_composantes_actives >= 1 and nb_composantes_actives <= 6),
  composantes                jsonb not null default '{}'::jsonb,
  variation_5j_pts           numeric(6,2),
  variation_20j_pts          numeric(6,2),
  variation_60j_pts          numeric(6,2),
  observables_marche         jsonb not null default '{}'::jsonb,
  methode_version            text not null default '1.0',
  updated_at                 timestamptz not null default now()
);

create index if not exists idx_stress_daily_index_date
  on public.stress_daily_index (date_marche desc);

alter table public.stress_daily_index enable row level security;

drop policy if exists "stress_daily_index_lecture_publique" on public.stress_daily_index;
create policy "stress_daily_index_lecture_publique"
  on public.stress_daily_index for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.stress_daily_index from public, anon, authenticated;
grant select on public.stress_daily_index to anon, authenticated;

comment on table public.stress_daily_index is
  'Indice quotidien descriptif de tension du marché BRVM (0-100, 6 composantes contemporaines renormalisées) et observables de séance sans signal.';
