-- ============================================================================
-- 0278_stress_backtesting.sql
-- Phase 3 du module BRVM Market Stress Monitor : Historical Backtesting Engine.
--
-- 1. public.stress_backtest_snapshots : snapshots pré-calculés des matrices
--    de rebonds post-correction (1/3/6/12/24M, IC bootstrap 95 %) et des
--    stratégies historiques avec validation walk-forward.
--    RLS fermée (Audit F-04) — lecture via service_role après `canAccess('stress_backtest')`.
-- 2. feature_flags : enregistrement de `stress_backtest` ('premium').
-- ============================================================================

create table if not exists public.stress_backtest_snapshots (
  id                     uuid primary key default gen_random_uuid(),
  date_calcul            date not null,
  indice_code            text not null,
  frais_aller_retour_pct numeric(6,4) not null default 1.5000 check (frais_aller_retour_pct >= 0 and frais_aller_retour_pct <= 10),
  mode_clustering_jours  integer not null default 90 check (mode_clustering_jours >= 1 and mode_clustering_jours <= 730),
  debut_serie            date,
  fin_serie              date,
  nb_seances             integer not null default 0 check (nb_seances >= 0),
  drawdown_actuel_pct    numeric(10,4),
  stats_seuils           jsonb not null default '[]'::jsonb,
  strategies             jsonb not null default '[]'::jsonb,
  limites_methodologiques jsonb not null default '{}'::jsonb,
  methode_version        text not null default '1.0',
  updated_at             timestamptz not null default now(),
  unique (date_calcul, indice_code, frais_aller_retour_pct, mode_clustering_jours)
);

create index if not exists idx_stress_backtest_lookup
  on public.stress_backtest_snapshots (indice_code, date_calcul desc);

-- Audit F-04 : fonctionnalité Premium -> aucune policy publique, accès service_role uniquement.
alter table public.stress_backtest_snapshots enable row level security;
revoke all on public.stress_backtest_snapshots from public, anon, authenticated;

comment on table public.stress_backtest_snapshots is
  'Snapshots pré-calculés du Historical Backtesting Engine (Stress Monitor Phase 3). RLS fermée (service_role après canAccess(''stress_backtest'')).';

insert into public.feature_flags (code, label, acces, description)
values (
  'stress_backtest',
  'Stress Monitor : Backtesting historique',
  'premium',
  'Statistiques de rebond post-correction (1 à 24 mois, IC bootstrap 95 %) et simulation de stratégies historiques anti-biais.'
)
on conflict (code) do nothing;
