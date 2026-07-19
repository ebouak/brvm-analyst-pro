-- ============================================================================
-- 0111_liquidity_daily.sql
-- Liquidité v2 : score quotidien par titre reconstitué depuis les échanges.
-- Spec : docs/superpowers/specs/2026-07-19-liquidite-v2-design.md
-- Score 0-100 (presence, activite, Amihud, Roll) nullable si < 10 séances.
-- Flux achat/vente (tick rule sur brvm_intraday_snapshots) nullable si pas
-- de snapshots. Donnée de marché => lecture publique, écriture service_role.
-- ============================================================================

create table if not exists public.liquidity_daily (
  code                text not null,
  date_marche         date not null,
  score               integer check (score is null or (score >= 0 and score <= 100)),
  classe              text check (classe is null or classe in ('A','B','C','D')),
  presence_pct        numeric(6,2) not null default 0
                        check (presence_pct >= 0 and presence_pct <= 100),
  activite            numeric(6,4) not null default 0,
  amihud              numeric(20,6),
  spread_roll_pct     numeric(8,4),
  valeur_moyenne_30j  numeric(20,2) not null default 0,
  seances_traitees    integer not null default 0,
  seances_marche      integer not null default 0,
  volume_achat        bigint,
  volume_vente        bigint,
  volume_neutre       bigint,
  flux_net_pct        numeric(6,2)
                        check (flux_net_pct is null or (flux_net_pct >= -100 and flux_net_pct <= 100)),
  engine_version      text not null default 'liq-v2.0.0',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (code, date_marche)
);

create index if not exists idx_liquidity_daily_date on public.liquidity_daily (date_marche desc);

alter table public.liquidity_daily enable row level security;

drop policy if exists "liquidity_daily_public_read" on public.liquidity_daily;
create policy "liquidity_daily_public_read"
  on public.liquidity_daily for select using (true);

revoke insert, update, delete on public.liquidity_daily from public, anon, authenticated;

comment on table public.liquidity_daily is
  'Score de liquidité quotidien par titre (0-100 : présence, activité, Amihud, Roll sur 30 séances), nul si moins de 10 séances disponibles. Flux acheteur/vendeur estimé par tick rule sur les snapshots intraday. Donnée de marché : lecture publique, écriture réservée au service_role.';
