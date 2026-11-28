-- ============================================================================
-- 0276_stress_crisis_engine.sql
-- Phase 1 du module BRVM Market Stress Monitor : Historical Crisis Engine.
--
-- Tables créées :
--   1. stress_data_sources   : traçabilité des sources et rapport de couverture
--   2. stress_macro_history  : séries macroéconomiques UEMOA sourcées (BCEAO, BM)
--   3. stress_crisis_episodes: registre des épisodes de drawdown et comparateur
--
-- Enrichissement rétrocompatible :
--   - brvm_indices_daily (+ source, + qualite) sans altérer les lignes existantes.
--
-- Données de marché publiques (aucune donnée personnelle) : lecture publique
-- (anon, authenticated), écriture réservée au service_role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Traçabilité sur brvm_indices_daily (rétrocompatible)
-- ---------------------------------------------------------------------------
alter table public.brvm_indices_daily
  add column if not exists source text;

alter table public.brvm_indices_daily
  add column if not exists qualite text;

-- ---------------------------------------------------------------------------
-- 2. Registre des sources historiques & couverture
-- ---------------------------------------------------------------------------
create table if not exists public.stress_data_sources (
  code_source            text primary key,
  libelle                text not null,
  type_source            text not null,
  url                    text,
  debut_date             date,
  fin_date               date,
  nb_seances_disponibles integer not null default 0 check (nb_seances_disponibles >= 0),
  nb_seances_manquantes  integer not null default 0 check (nb_seances_manquantes >= 0),
  couverture_pct         numeric(6,2) check (couverture_pct is null or (couverture_pct >= 0 and couverture_pct <= 100)),
  indices_disponibles    text[] not null default '{}',
  statut                 text not null default 'actif',
  metadata               jsonb not null default '{}'::jsonb,
  updated_at             timestamptz not null default now()
);

alter table public.stress_data_sources enable row level security;

drop policy if exists "stress_data_sources_lecture_publique" on public.stress_data_sources;
create policy "stress_data_sources_lecture_publique"
  on public.stress_data_sources for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.stress_data_sources from public, anon, authenticated;
grant select on public.stress_data_sources to anon, authenticated;

comment on table public.stress_data_sources is
  'Registre des sources historiques et rapports de couverture du BRVM Market Stress Monitor.';

-- ---------------------------------------------------------------------------
-- 3. Séries macroéconomiques UEMOA sourcées (1998-2026+)
-- ---------------------------------------------------------------------------
create table if not exists public.stress_macro_history (
  id                bigint generated always as identity primary key,
  indicateur        text not null,
  zone              text not null,
  date_valeur       date not null,
  valeur            numeric(14,4) not null,
  unite             text not null,
  source            text not null,
  source_url        text,
  date_publication  date,
  note              text,
  created_at        timestamptz not null default now(),
  unique (indicateur, zone, date_valeur)
);

create index if not exists idx_stress_macro_ind_date
  on public.stress_macro_history (indicateur, date_valeur desc);

alter table public.stress_macro_history enable row level security;

drop policy if exists "stress_macro_history_lecture_publique" on public.stress_macro_history;
create policy "stress_macro_history_lecture_publique"
  on public.stress_macro_history for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.stress_macro_history from public, anon, authenticated;
grant select on public.stress_macro_history to anon, authenticated;

comment on table public.stress_macro_history is
  'Historique macroéconomique UEMOA sourcé (taux directeurs BCEAO, croissance PIB, inflation).';

-- ---------------------------------------------------------------------------
-- 4. Registre des crises historiques détectées par algorithme
-- ---------------------------------------------------------------------------
create table if not exists public.stress_crisis_episodes (
  id                              bigint generated always as identity primary key,
  indice_code                     text not null,
  seuil_pct                       numeric(6,2) not null,
  niveau                          text not null check (
    niveau in (
      'correction_moderee',
      'correction_significative',
      'correction_severe',
      'marche_baissier',
      'crise_majeure',
      'crise_extreme'
    )
  ),
  libelle                         text not null,
  date_sommet                     date not null,
  valeur_sommet                   numeric(18,4) not null check (valeur_sommet > 0),
  date_debut_correction           date not null,
  date_creux                      date not null,
  valeur_creux                    numeric(18,4) not null check (valeur_creux > 0),
  perte_max_pct                   numeric(8,4) not null,
  nb_seances_baisse               integer not null check (nb_seances_baisse >= 0),
  duree_calendaire_baisse         integer not null check (duree_calendaire_baisse >= 0),
  nb_rebonds_intermediaires       integer not null default 0 check (nb_rebonds_intermediaires >= 0),
  amplitude_max_rebond_pct        numeric(8,4),
  date_recuperation               date,
  nb_seances_rebond               integer,
  duree_totale_recuperation_jours integer,
  perf_cumulee_recuperation_pct   numeric(8,4),
  statut                          text not null check (statut in ('en_cours', 'termine')),
  rebond_1m_pct                   numeric(8,4),
  rebond_3m_pct                   numeric(8,4),
  rebond_6m_pct                   numeric(8,4),
  rebond_12m_pct                  numeric(8,4),
  rebond_24m_pct                  numeric(8,4),
  similarite_actuelle             numeric(6,2),
  similarite_details              jsonb,
  contexte_marche                 jsonb not null default '{}'::jsonb,
  contexte_macro                  jsonb not null default '{}'::jsonb,
  contexte_entreprises            jsonb not null default '{}'::jsonb,
  trajectoire_base100             jsonb not null default '[]'::jsonb,
  methode_version                 text not null default '1.0',
  updated_at                      timestamptz not null default now(),
  unique (indice_code, seuil_pct, date_sommet)
);

create index if not exists idx_stress_crises_lookup
  on public.stress_crisis_episodes (indice_code, seuil_pct, date_sommet desc);

alter table public.stress_crisis_episodes enable row level security;

drop policy if exists "stress_crisis_episodes_lecture_publique" on public.stress_crisis_episodes;
create policy "stress_crisis_episodes_lecture_publique"
  on public.stress_crisis_episodes for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.stress_crisis_episodes from public, anon, authenticated;
grant select on public.stress_crisis_episodes to anon, authenticated;

comment on table public.stress_crisis_episodes is
  'Épisodes historiques de correction/crise détectés automatiquement par drawdown sur les indices BRVM. Lecture publique, écriture service_role.';
