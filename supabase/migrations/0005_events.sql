-- ============================================================================
-- BRVM Analyst Pro — Module 6 : Rapports & Événements (§6)
--   market_events           : événements de marché (communiqués, avis, etc.)
--   market_event_instruments: pivot événement <-> titres
--   report_snapshots        : rapports sauvegardés par utilisateur
-- ============================================================================

create table if not exists public.market_events (
  id               uuid primary key default gen_random_uuid(),
  event_date       date not null,
  event_datetime   timestamptz,
  source           text not null,
  source_url       text,
  source_type      text not null,          -- communique | avis | info_permanente | rapport | bulletin | publication
  title            text not null,
  summary          text,
  event_type       text not null,          -- dividende | resultats | assemblee | admission | suspension | autre
  issuer_name      text,
  instrument_code  text references public.brvm_instruments(code) on update cascade,
  instrument_id    uuid,
  sector           text,
  country_code     char(2),
  importance_level int check (importance_level is null or importance_level between 1 and 5),
  sentiment        text check (sentiment is null or sentiment in ('positive','neutral','negative')),
  tags             text[],
  -- empreinte pour idempotence d'ingestion (source_url + title + date).
  dedupe_hash      text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_events_date on public.market_events (event_date desc);
create index if not exists idx_events_code on public.market_events (instrument_code, event_date desc);
create index if not exists idx_events_type on public.market_events (event_type, event_date desc);
create index if not exists idx_events_source_type on public.market_events (source_type, event_date desc);

create table if not exists public.market_event_instruments (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.market_events(id) on delete cascade,
  instrument_code text not null references public.brvm_instruments(code) on update cascade,
  relation_type  text,                      -- emetteur | concerne | secteur
  created_at     timestamptz not null default now(),
  unique (event_id, instrument_code)
);
create index if not exists idx_evt_instr_event on public.market_event_instruments (event_id);
create index if not exists idx_evt_instr_code on public.market_event_instruments (instrument_code);

create table if not exists public.report_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  report_type  text not null,               -- instrument | sector | market | event
  params       jsonb not null,
  title        text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_report_snapshots_user on public.report_snapshots (user_id);

-- updated_at sur market_events.
drop trigger if exists trg_events_updated on public.market_events;
create trigger trg_events_updated before update on public.market_events
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS : événements en lecture publique (§16 "données publiques lisibles") ;
-- rapports sauvegardés privés par utilisateur.
-- ----------------------------------------------------------------------------
alter table public.market_events            enable row level security;
alter table public.market_event_instruments enable row level security;
alter table public.report_snapshots         enable row level security;

drop policy if exists "lecture publique events" on public.market_events;
create policy "lecture publique events"
  on public.market_events for select using (true);

drop policy if exists "lecture publique event_instruments" on public.market_event_instruments;
create policy "lecture publique event_instruments"
  on public.market_event_instruments for select using (true);
-- écriture events réservée au service_role (ingestor) -> aucune policy write.

drop policy if exists "report_snapshots: proprietaire seul - all" on public.report_snapshots;
create policy "report_snapshots: proprietaire seul - all"
  on public.report_snapshots for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
