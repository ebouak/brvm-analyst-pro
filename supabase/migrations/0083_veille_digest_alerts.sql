-- ============================================================================
-- 0083_veille_digest_alerts.sql
-- Tables de la veille « intelligente » (digest / alerts / job runs) : écrites
-- par scraper/src/veille/repository.ts, lues par la page /admin/veille-brvm.
-- Jamais créées en prod → la page admin plantait (500). Schéma dérivé du code.
-- Données admin-only : RLS activée SANS policy → deny-all anon/authenticated ;
-- les routes admin passent par service_role (bypass RLS).
-- ============================================================================

create table if not exists public.brvm_veille_digest (
  id              bigserial primary key,
  date_marche     date not null,
  source          text not null,
  category        text,
  title           text not null,
  summary         text,
  url             text,
  relevance_score numeric,
  sentiment       text default 'neutral',
  tags            text[] default '{}',
  full_content    jsonb default '{}'::jsonb,
  is_critical     boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (title, source, date_marche)
);
create index if not exists idx_veille_digest_source_created
  on public.brvm_veille_digest (source, created_at desc);

create table if not exists public.brvm_veille_alerts (
  id                 bigserial primary key,
  digest_id          bigint references public.brvm_veille_digest(id) on delete cascade,
  alert_type         text not null,
  severity           text,
  description        text,
  recommended_action text,
  acknowledged_at    timestamptz,
  acknowledged_by    uuid,
  created_at         timestamptz not null default now()
);
create index if not exists idx_veille_alerts_unack
  on public.brvm_veille_alerts (created_at desc) where acknowledged_at is null;

create table if not exists public.brvm_veille_job_runs (
  id            bigserial primary key,
  date_marche   date,
  source        text,
  status        text,
  items_fetched integer,
  items_stored  integer,
  errors_count  integer default 0,
  error_message text,
  duration_ms   integer,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

alter table public.brvm_veille_digest   enable row level security;
alter table public.brvm_veille_alerts    enable row level security;
alter table public.brvm_veille_job_runs  enable row level security;
