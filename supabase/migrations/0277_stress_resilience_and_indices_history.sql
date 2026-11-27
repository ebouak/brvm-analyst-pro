-- ============================================================================
-- 0277_stress_resilience_and_indices_history.sql
--
-- 1. public.stress_indices_history : table dédiée aux historiques d'indices
--    importés (Sikafinance, CSV), protégeant brvm_indices_daily de toute écriture.
-- 2. public.stress_resilience_daily : snapshots pré-calculés du Stock
--    Resilience Scanner (Phase 2 — fonctionnalité Premium `stress_scanner`).
-- 3. feature_flags : enregistrement de `stress_scanner` ('premium').
-- 4. brvm_instruments : complétion sécurisée des 4 pays manquants (pays IS NULL).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table dédiée aux historiques d'indices (lecture publique)
-- ---------------------------------------------------------------------------
create table if not exists public.stress_indices_history (
  code              text not null,
  date_marche       date not null,
  libelle           text,
  valeur            numeric(18,4) not null check (valeur > 0),
  valeur_precedente numeric(18,4),
  variation_pct     numeric(10,4),
  volume            bigint check (volume is null or volume >= 0),
  valeur_echangee   numeric(20,2) check (valeur_echangee is null or valeur_echangee >= 0),
  capitalisation    numeric(22,2) check (capitalisation is null or capitalisation >= 0),
  nb_hausses        integer check (nb_hausses is null or nb_hausses >= 0),
  nb_baisses        integer check (nb_baisses is null or nb_baisses >= 0),
  nb_inchanges      integer check (nb_inchanges is null or nb_inchanges >= 0),
  source            text not null,
  qualite           text not null default 'historique_reconstitue',
  created_at        timestamptz not null default now(),
  primary key (code, date_marche)
);

create index if not exists idx_stress_indices_history_date
  on public.stress_indices_history (date_marche desc);

alter table public.stress_indices_history enable row level security;

drop policy if exists "stress_indices_history_lecture_publique" on public.stress_indices_history;
create policy "stress_indices_history_lecture_publique"
  on public.stress_indices_history for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.stress_indices_history from public, anon, authenticated;
grant select on public.stress_indices_history to anon, authenticated;

comment on table public.stress_indices_history is
  'Séries historiques quotidiennes des indices BRVM (Sikafinance / CSV validé), fusionnées à la lecture avec brvm_indices_daily (prioritaire).';

-- ---------------------------------------------------------------------------
-- 2. Snapshots du Stock Resilience Scanner (RLS fermée — Premium)
-- ---------------------------------------------------------------------------
create table if not exists public.stress_resilience_daily (
  code                          text not null,
  date_marche                   date not null,
  designation                   text not null,
  secteur                       text not null,
  pays                          text,
  famille_comptable             text not null default 'general',
  isin                          text,
  date_introduction             date,
  capitalisation                numeric(22,2),
  cours_jour                    numeric(18,4),
  perf_1j_pct                   numeric(10,4),
  perf_5j_pct                   numeric(10,4),
  perf_1m_pct                   numeric(10,4),
  perf_3m_pct                   numeric(10,4),
  perf_6m_pct                   numeric(10,4),
  perf_ytd_pct                  numeric(10,4),
  perf_1a_pct                   numeric(10,4),
  perf_totale_1a_pct            numeric(10,4),
  perf_totale_ytd_pct           numeric(10,4),
  drawdown_pct                  numeric(10,4),
  date_sommet                   date,
  valeur_sommet                 numeric(18,4),
  volatilite_ann_pct            numeric(10,4),
  beta                          numeric(10,4),
  force_relative_pct            numeric(10,4),
  resistance_jours_baisse_pct   numeric(10,4),
  freq_seances_positives_pct    numeric(6,2),
  stabilite_volumes             numeric(10,4),
  decrochage_relatif_pct        numeric(10,4),
  alpha_anormal_pct             numeric(10,4),
  decrochage_anormal            boolean not null default false,
  explication_decrochage        jsonb not null default '{}'::jsonb,
  fondamentaux                  jsonb not null default '{}'::jsonb,
  dividendes                    jsonb not null default '{}'::jsonb,
  liquidite                     jsonb not null default '{}'::jsonb,
  score_opportunite             numeric(6,2),
  score_confiance               numeric(6,2) not null default 0,
  sous_scores                   jsonb not null default '{}'::jsonb,
  categorie                     text not null check (
    categorie in ('qualite_elevee', 'potentiel_a_etudier', 'vigilance', 'risque_eleve')
  ),
  classement_a_rang             integer,
  classement_b_rang             integer,
  classement_c_rang             integer,
  illiquide_flag                boolean not null default false,
  anomalies_donnees             text[] not null default '{}',
  methode_version               text not null default '1.0',
  updated_at                    timestamptz not null default now(),
  primary key (code, date_marche)
);

create index if not exists idx_stress_resilience_date_score
  on public.stress_resilience_daily (date_marche desc, score_opportunite desc nulls last);

-- Audit F-04 : fonctionnalité Premium -> aucune policy publique, accès service_role uniquement.
alter table public.stress_resilience_daily enable row level security;
revoke all on public.stress_resilience_daily from public, anon, authenticated;

comment on table public.stress_resilience_daily is
  'Snapshots quotidiens du Stock Resilience Scanner (Stress Monitor Phase 2). RLS fermée (service_role après canAccess(''stress_scanner'')).';

-- ---------------------------------------------------------------------------
-- 3. Flag d'accès Premium pour le Stock Resilience Scanner
-- ---------------------------------------------------------------------------
insert into public.feature_flags (code, label, acces, description)
values (
  'stress_scanner',
  'Stress Monitor : Analyse des valeurs',
  'premium',
  'Stock Resilience Scanner : classements A/B/C, décrochages anormaux, heatmap sectorielle pondérée et scoring fondamental.'
)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Complétion sécurisée des pays manquants sur brvm_instruments
-- ---------------------------------------------------------------------------
update public.brvm_instruments set pays = 'Côte d''Ivoire' where code = 'SIBC' and pays is null;
update public.brvm_instruments set pays = 'Bénin'          where code = 'LNBB' and pays is null;
update public.brvm_instruments set pays = 'Côte d''Ivoire' where code = 'ORAC' and pays is null;
update public.brvm_instruments set pays = 'Côte d''Ivoire' where code = 'SCRC' and pays is null;
