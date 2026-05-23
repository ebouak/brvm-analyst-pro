-- ============================================================================
-- BRVM Analyst Pro — Schéma initial (cf. Cahier des charges §8)
-- Tables marché, référentiel, scraping, signaux, watchlist, portefeuille.
-- ============================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 6.1 Référentiel instruments (évite la duplication pays/secteur/type/statut)
-- ---------------------------------------------------------------------------
create table if not exists public.brvm_instruments (
  code            text primary key,
  designation     text not null,
  pays            text,
  secteur         text,
  type            text not null check (type in ('action','obligation','indice')),
  actif           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.brvm_instruments is 'Univers des titres BRVM (référentiel partagé).';

-- ---------------------------------------------------------------------------
-- Actions — cotations journalières
-- ---------------------------------------------------------------------------
create table if not exists public.brvm_actions_daily (
  id               bigint generated always as identity primary key,
  code             text not null references public.brvm_instruments(code) on update cascade,
  date_marche      date not null,
  designation      text,
  pays             text,
  secteur          text,
  cours_precedent  numeric(18,4) check (cours_precedent is null or cours_precedent >= 0),
  cours_jour       numeric(18,4) check (cours_jour is null or cours_jour >= 0),
  variation_pct    numeric(10,4),
  volume           bigint check (volume is null or volume >= 0),
  nb_transactions  integer check (nb_transactions is null or nb_transactions >= 0),
  valeur_echangee  numeric(20,2) check (valeur_echangee is null or valeur_echangee >= 0),
  created_at       timestamptz not null default now(),
  unique (code, date_marche)
);
create index if not exists idx_actions_date on public.brvm_actions_daily (date_marche desc);
create index if not exists idx_actions_code_date on public.brvm_actions_daily (code, date_marche desc);

-- ---------------------------------------------------------------------------
-- Obligations — cotations journalières
-- ---------------------------------------------------------------------------
create table if not exists public.brvm_obligations_daily (
  id               bigint generated always as identity primary key,
  code             text not null references public.brvm_instruments(code) on update cascade,
  date_marche      date not null,
  designation      text,
  emetteur         text,
  taux_pct         numeric(10,4),
  maturite         date,
  cours_precedent  numeric(18,4) check (cours_precedent is null or cours_precedent >= 0),
  cours_jour       numeric(18,4) check (cours_jour is null or cours_jour >= 0),
  volume           bigint check (volume is null or volume >= 0),
  valeur_echangee  numeric(20,2) check (valeur_echangee is null or valeur_echangee >= 0),
  created_at       timestamptz not null default now(),
  unique (code, date_marche)
);
create index if not exists idx_obl_date on public.brvm_obligations_daily (date_marche desc);
create index if not exists idx_obl_code_date on public.brvm_obligations_daily (code, date_marche desc);

-- ---------------------------------------------------------------------------
-- Indices — valeurs journalières (BRVM 30, BRVM Composite, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.brvm_indices_daily (
  id                 bigint generated always as identity primary key,
  code               text not null references public.brvm_instruments(code) on update cascade,
  date_marche        date not null,
  libelle            text,
  valeur             numeric(18,4),
  valeur_precedente  numeric(18,4),
  variation_pct      numeric(10,4),
  created_at         timestamptz not null default now(),
  unique (code, date_marche)
);
create index if not exists idx_indices_date on public.brvm_indices_daily (date_marche desc);

-- ---------------------------------------------------------------------------
-- 6.2 Journal technique du scraping
-- ---------------------------------------------------------------------------
create table if not exists public.scrape_runs (
  id              bigint generated always as identity primary key,
  source          text not null,
  started_at      timestamptz not null,
  finished_at     timestamptz,
  status          text not null check (status in ('success','partial','failed','mock')),
  nb_actions      integer not null default 0,
  nb_obligations  integer not null default 0,
  nb_indices      integer not null default 0,
  message_erreur  text,
  hash_source     text,
  date_marche     date,
  created_at      timestamptz not null default now()
);
create index if not exists idx_scrape_runs_date on public.scrape_runs (date_marche desc, created_at desc);
create index if not exists idx_scrape_runs_hash on public.scrape_runs (hash_source);

-- ---------------------------------------------------------------------------
-- 5.4 / 6.7 Signaux d'investissement (explicables)
-- ---------------------------------------------------------------------------
create table if not exists public.signals_daily (
  id              bigint generated always as identity primary key,
  code            text not null references public.brvm_instruments(code) on update cascade,
  date_marche     date not null,
  signal          text not null check (signal in ('BUY','HOLD','SELL')),
  score_total     numeric(10,4) not null,
  -- sous-scores pour l'explicabilité
  score_variation numeric(10,4),
  score_volume    numeric(10,4),
  score_rsi       numeric(10,4),
  bonus_tendance  numeric(10,4) default 0,
  penalite_liquidite numeric(10,4) default 0,
  confiance       numeric(5,4) check (confiance is null or (confiance >= 0 and confiance <= 1)),
  explication     text,
  inputs          jsonb,  -- snapshot des valeurs ayant produit le signal
  created_at      timestamptz not null default now(),
  unique (code, date_marche)
);
create index if not exists idx_signals_date on public.signals_daily (date_marche desc);
create index if not exists idx_signals_signal on public.signals_daily (signal, date_marche desc);

-- ---------------------------------------------------------------------------
-- 5.5 Watchlists & items (privés par utilisateur)
-- ---------------------------------------------------------------------------
create table if not exists public.watchlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nom         text not null default 'Ma watchlist',
  created_at  timestamptz not null default now()
);
create index if not exists idx_watchlists_user on public.watchlists (user_id);

create table if not exists public.watchlist_items (
  id            uuid primary key default gen_random_uuid(),
  watchlist_id  uuid not null references public.watchlists(id) on delete cascade,
  code          text not null references public.brvm_instruments(code) on update cascade,
  note          text,
  prix_alerte_haut  numeric(18,4),
  prix_alerte_bas   numeric(18,4),
  created_at    timestamptz not null default now(),
  unique (watchlist_id, code)
);
create index if not exists idx_watchlist_items_wl on public.watchlist_items (watchlist_id);

-- ---------------------------------------------------------------------------
-- 5.5 Positions de portefeuille (privées)
-- ---------------------------------------------------------------------------
create table if not exists public.portfolios_positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  code          text not null references public.brvm_instruments(code) on update cascade,
  quantite      numeric(20,4) not null check (quantite >= 0),
  prix_entree   numeric(18,4) not null check (prix_entree >= 0),
  date_entree   date,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_positions_user on public.portfolios_positions (user_id);

-- ---------------------------------------------------------------------------
-- Alertes (prix) — privées
-- ---------------------------------------------------------------------------
create table if not exists public.alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  code          text not null references public.brvm_instruments(code) on update cascade,
  type          text not null check (type in ('prix_au_dessus','prix_en_dessous','variation')),
  seuil         numeric(18,4) not null,
  actif         boolean not null default true,
  declenchee_le timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_alerts_user on public.alerts (user_id);
create index if not exists idx_alerts_actif on public.alerts (actif) where actif;

-- ---------------------------------------------------------------------------
-- Trigger updated_at générique
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_instruments_updated on public.brvm_instruments;
create trigger trg_instruments_updated before update on public.brvm_instruments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_positions_updated on public.portfolios_positions;
create trigger trg_positions_updated before update on public.portfolios_positions
  for each row execute function public.set_updated_at();
