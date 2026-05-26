-- ============================================================================
-- BRVM Analyst Pro — Migration 0009 : compatibilité V2.0 + extensions
--   - VIEWS instruments / daily_quotes / opportunity_scores (alias EN)
--   - alerts : threshold_hash (généré) + cooldown_hours + last_triggered_at
--   - watchlists : is_default
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VIEWS alias V2.0 (compat sans migration data)
-- ----------------------------------------------------------------------------
create or replace view public.instruments as
  select
    code                              as code,
    designation                       as designation,
    coalesce(pays, '')::char(2)       as country_code,
    secteur                           as sector,
    type                              as instrument_type,
    actif                             as is_active,
    created_at,
    updated_at
  from public.brvm_instruments;

create or replace view public.daily_quotes as
  select
    a.id,
    a.code                            as instrument_code,
    a.date_marche,
    a.cours_jour                      as close_price,
    a.cours_precedent                 as previous_close,
    a.variation_pct,
    a.volume,
    a.nb_transactions                 as transactions_count,
    a.valeur_echangee                 as traded_value,
    null::numeric(6,4)                as ytm,
    null::numeric(6,2)                as duration_macaulay,
    null::numeric(6,2)                as duration_modified,
    null::date                        as maturity_date,
    'BDFIN'                           as data_source,
    true                              as is_validated,
    a.created_at
  from public.brvm_actions_daily a
  union all
  select
    o.id,
    o.code,
    o.date_marche,
    o.cours_jour,
    o.cours_precedent,
    null::numeric(10,4),
    o.volume,
    null::integer,
    o.valeur_echangee,
    o.taux_pct,
    null::numeric(6,2),
    null::numeric(6,2),
    o.maturite,
    'BDFIN',
    true,
    o.created_at
  from public.brvm_obligations_daily o;

create or replace view public.opportunity_scores as
  select
    s.id,
    s.code                            as instrument_code,
    s.date_marche,
    s.score_total,
    s.signal,
    s.confiance                       as confidence,
    s.score_variation                 as variation_norm,
    s.score_volume                    as volume_signal,
    s.score_rsi                       as rsi_signal,
    s.bonus_tendance,
    s.penalite_liquidite,
    s.explication                     as explanation_text,
    s.inputs                          as inputs_jsonb,
    false                             as is_forced_hold,
    null::text                        as force_hold_reason,
    s.created_at
  from public.signals_daily s;

comment on view public.instruments is 'Alias V2.0 (EN) sur brvm_instruments.';
comment on view public.daily_quotes is 'Alias V2.0 unifié actions + obligations.';
comment on view public.opportunity_scores is 'Alias V2.0 sur signals_daily.';

-- ----------------------------------------------------------------------------
-- 2. alerts : threshold_hash (généré), cooldown_hours, last_triggered_at
-- ----------------------------------------------------------------------------
-- declenchee_le existe déjà mais last_triggered_at correspond mieux au vocabulaire spec.
alter table public.alerts
  add column if not exists cooldown_hours integer not null default 24,
  add column if not exists threshold_hash text generated always as
    (md5(type || ':' || seuil::text)) stored;

-- Index pour empêcher les doublons logiques (même type/seuil pour un user/code).
create unique index if not exists idx_alerts_user_code_threshold
  on public.alerts (user_id, code, type, threshold_hash);

-- View alias last_triggered_at -> declenchee_le pour exposer le vocab V2.0.
-- (Les apps existantes continuent d'utiliser declenchee_le.)
comment on column public.alerts.cooldown_hours is
  'Heures min entre 2 déclenchements d''une même alerte (anti-spam).';

-- ----------------------------------------------------------------------------
-- 3. watchlists : is_default + nom unique par user (déjà implicite via PK)
-- ----------------------------------------------------------------------------
alter table public.watchlists
  add column if not exists is_default boolean not null default false;

-- Une seule watchlist par défaut par utilisateur.
create unique index if not exists idx_watchlists_user_default
  on public.watchlists (user_id) where is_default;

-- Nom unique par user pour éviter les doublons "Ma watchlist" / "Ma watchlist".
create unique index if not exists idx_watchlists_user_nom
  on public.watchlists (user_id, nom);
