-- ============================================================================
-- 0081_intraday_snapshots_and_pipeline.sql
-- Réparation complète du pipeline patterns intraday.
-- Découverte : loadSnapshots() était un stub (retour []) → 0 chandelle → 0
-- pattern ; et le scraper intraday écrasait brvm_actions_daily (pas d'historique
-- tick). On introduit une table de snapshots historisés, alimentée en append
-- par le scraper, lue par la reconstruction de chandelles.
-- ============================================================================

-- 1) Historisation des captures 15 min (source des chandelles).
create table if not exists public.brvm_intraday_snapshots (
  id           bigserial primary key,
  code         text not null,
  date_marche  date not null,
  captured_at  timestamptz not null default now(),
  close        numeric(20,4),
  volume       bigint,
  created_at   timestamptz not null default now()
);
create index if not exists idx_intraday_snapshots_code_date
  on public.brvm_intraday_snapshots (code, date_marche, captured_at);
alter table public.brvm_intraday_snapshots enable row level security;
drop policy if exists "intraday_snapshots_public_read" on public.brvm_intraday_snapshots;
create policy "intraday_snapshots_public_read"
  on public.brvm_intraday_snapshots for select using (true);
revoke insert, update, delete on public.brvm_intraday_snapshots from anon, authenticated;

-- 2) brvm_intraday_patterns : bornes de chandelle en timestamptz (le code envoie
--    des ISO) + contrainte unique = clé onConflict de l'upsert (sinon échec).
alter table public.brvm_intraday_patterns
  drop column if exists candle_start_time,
  drop column if exists candle_end_time,
  add column candle_start_time timestamptz,
  add column candle_end_time   timestamptz;
create unique index if not exists uq_brvm_intraday_patterns
  on public.brvm_intraday_patterns
     (code, date_marche, pattern_type, timeframe, candle_start_time, engine_version);

-- 3) brvm_intraday_patterns_raw : détections brutes (PHASE 3A), attendue par le code.
create table if not exists public.brvm_intraday_patterns_raw (
  id                bigserial primary key,
  code              text not null,
  date_marche       date not null,
  pattern_type      text not null,
  timeframe         text not null,
  candle_start_time timestamptz,
  candle_end_time   timestamptz,
  detected_at       timestamptz,
  value             numeric(20,4),
  threshold         numeric(20,4),
  is_triggered      boolean not null default false,
  metadata          jsonb,
  engine_version    text,
  rules_version     text,
  created_at        timestamptz not null default now()
);
create unique index if not exists uq_brvm_intraday_patterns_raw
  on public.brvm_intraday_patterns_raw
     (code, date_marche, pattern_type, timeframe, candle_start_time, engine_version);
alter table public.brvm_intraday_patterns_raw enable row level security;
drop policy if exists "intraday_patterns_raw_public_read" on public.brvm_intraday_patterns_raw;
create policy "intraday_patterns_raw_public_read"
  on public.brvm_intraday_patterns_raw for select using (true);
revoke insert, update, delete on public.brvm_intraday_patterns_raw from anon, authenticated;
