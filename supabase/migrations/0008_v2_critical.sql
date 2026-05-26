-- ============================================================================
-- BRVM Analyst Pro — Migration 0008 : briques critiques V2.0
--   - market_calendar        : calendrier UEMOA + jours fériés
--   - technical_indicators   : indicateurs persistés par séance
--   - data_quality_alerts    : journal des anomalies détectées
--   - backtest_runs          : runs de backtest sauvegardés (utilisateur)
--
-- Conserve le schéma existant (brvm_instruments, brvm_actions_daily, ...).
-- Référence : SPEC-MÉTIER V2.0 §3.3, §3.4, §4.2, §9.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Calendrier marché UEMOA
-- ----------------------------------------------------------------------------
create table if not exists public.market_calendar (
  date           date primary key,
  is_trading_day boolean not null,
  country_code   char(2),
  holiday_name   text,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_market_calendar_trading
  on public.market_calendar (date) where is_trading_day;

create or replace view public.trading_days as
  select date from public.market_calendar where is_trading_day = true;

comment on table public.market_calendar is
  'Calendrier UEMOA : jours ouvrés BRVM et jours fériés par pays.';

-- ----------------------------------------------------------------------------
-- 2. Indicateurs techniques persistés
-- ----------------------------------------------------------------------------
create table if not exists public.technical_indicators (
  id                    bigint generated always as identity primary key,
  instrument_code       text not null references public.brvm_instruments(code) on update cascade,
  date_marche           date not null,
  sma_20                numeric(18,4),
  sma_50                numeric(18,4),
  sma_200               numeric(18,4),
  ema_12                numeric(18,4),
  ema_26                numeric(18,4),
  rsi_14                numeric(5,2) check (rsi_14 is null or (rsi_14 between 0 and 100)),
  macd_line             numeric(18,4),
  macd_signal           numeric(18,4),
  macd_histogram        numeric(18,4),
  is_oversold           boolean,
  is_overbought         boolean,
  is_golden_cross       boolean,
  is_death_cross        boolean,
  is_breakout_20d_high  boolean,
  is_breakdown_20d_low  boolean,
  min_history_required  integer default 200,
  is_reliable           boolean,
  created_at            timestamptz not null default now(),
  unique (instrument_code, date_marche)
);
create index if not exists idx_ti_code_date
  on public.technical_indicators (instrument_code, date_marche desc);

comment on table public.technical_indicators is
  'Indicateurs techniques journaliers persistés (cf. spec §3.4 / §5).';

-- ----------------------------------------------------------------------------
-- 3. Journal des anomalies de qualité de données (cf. spec §4.2)
-- ----------------------------------------------------------------------------
create table if not exists public.data_quality_alerts (
  id                bigint generated always as identity primary key,
  instrument_code   text references public.brvm_instruments(code) on update cascade,
  date_marche       date,
  alert_type        text not null,         -- variation_anomalie | volume_nul | structure_html | completude
  severity          text not null check (severity in ('info','warning','critical')),
  message           text not null,
  context_jsonb     jsonb,
  scrape_run_id     bigint references public.scrape_runs(id) on delete set null,
  is_acknowledged   boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists idx_dqa_date
  on public.data_quality_alerts (date_marche desc, severity);
create index if not exists idx_dqa_unack
  on public.data_quality_alerts (created_at desc) where not is_acknowledged;

comment on table public.data_quality_alerts is
  'Anomalies détectées par le pipeline qualité (variation > 30%, etc.).';

-- Trigger : détecte les variations anormales sur insert dans brvm_actions_daily.
create or replace function public.check_quote_anomaly()
returns trigger language plpgsql as $$
begin
  if new.variation_pct is not null and abs(new.variation_pct) > 30 then
    insert into public.data_quality_alerts
      (instrument_code, date_marche, alert_type, severity, message, context_jsonb)
    values (
      new.code, new.date_marche, 'variation_anomalie', 'warning',
      'Variation absolue > 30% détectée : ' || new.variation_pct::text || '%',
      jsonb_build_object(
        'cours_jour', new.cours_jour,
        'cours_precedent', new.cours_precedent,
        'variation_pct', new.variation_pct
      )
    );
  end if;
  return new;
end; $$;

drop trigger if exists trg_check_quote_anomaly on public.brvm_actions_daily;
create trigger trg_check_quote_anomaly
  after insert or update on public.brvm_actions_daily
  for each row execute function public.check_quote_anomaly();

-- ----------------------------------------------------------------------------
-- 4. Runs de backtest (sauvegarde par utilisateur)
-- ----------------------------------------------------------------------------
create table if not exists public.backtest_runs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  instrument_code     text not null references public.brvm_instruments(code) on update cascade,
  date_from           date not null,
  date_to             date not null,
  initial_capital     numeric(18,2) not null,
  transaction_cost_pct numeric(6,4) not null default 0.6,
  slippage_pct        numeric(6,4) not null default 0,
  -- résultats
  total_return_pct    numeric(10,4),
  annualized_return_pct numeric(10,4),
  max_drawdown_pct    numeric(10,4),
  volatility_pct      numeric(10,4),
  sharpe_ratio        numeric(10,4),
  win_rate_pct        numeric(10,4),
  nb_trades           integer,
  buy_hold_return_pct numeric(10,4),
  equity_curve_jsonb  jsonb,
  trades_jsonb        jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_backtest_user
  on public.backtest_runs (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.market_calendar       enable row level security;
alter table public.technical_indicators  enable row level security;
alter table public.data_quality_alerts   enable row level security;
alter table public.backtest_runs         enable row level security;

create policy "lecture publique market_calendar"
  on public.market_calendar for select using (true);
create policy "lecture publique technical_indicators"
  on public.technical_indicators for select using (true);
create policy "lecture authentifiee data_quality_alerts"
  on public.data_quality_alerts for select to authenticated using (true);

create policy "backtest_runs: proprietaire seul - all"
  on public.backtest_runs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. Seed : jours fériés UEMOA 2026 (§14.2)
-- ----------------------------------------------------------------------------
insert into public.market_calendar (date, is_trading_day, country_code, holiday_name) values
  ('2026-01-01', false, null, 'Jour de l''an'),
  ('2026-04-06', false, null, 'Lundi de Pâques'),
  ('2026-04-07', false, null, 'Mardi de Pâques'),
  ('2026-05-01', false, null, 'Fête du Travail'),
  ('2026-05-14', false, null, 'Ascension'),
  ('2026-05-25', false, null, 'Lundi de Pentecôte'),
  ('2026-08-07', false, 'CI', 'Fête de l''Indépendance (CI)'),
  ('2026-12-25', false, null, 'Noël'),
  ('2026-12-26', false, null, 'Lendemain de Noël')
on conflict (date) do nothing;
