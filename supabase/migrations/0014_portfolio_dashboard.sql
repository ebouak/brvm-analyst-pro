-- ============================================================================
-- BRVM Analyst Pro — Portfolio Dashboard Tables
-- Tables for monthly tracking, movements, positions, and reference data.
-- User-scoped tables (1-3) with RLS policies; public reference table (4).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table 1: portfolio_monthly_tracking
-- Stores monthly portfolio performance metrics (valeur, flux, rendement).
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_monthly_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  year integer not null,
  valeur_initiale numeric(15,2) default 0,
  apports numeric(15,2) default 0,
  retraits numeric(15,2) default 0,
  flux_ponderes numeric(15,2) default 0,
  valeur_finale numeric(15,2) not null,
  performance_mensuelle numeric(10,8),
  indice_base100 numeric(10,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_portfolio_monthly_user_date
  on public.portfolio_monthly_tracking (user_id, date desc);
create index if not exists idx_portfolio_monthly_year
  on public.portfolio_monthly_tracking (user_id, year desc);

comment on table public.portfolio_monthly_tracking is
  'Suivi mensuel du portefeuille : performance, flux pondérés, indice base 100.';

-- ---------------------------------------------------------------------------
-- Table 2: portfolio_movements
-- Records daily cash flows (apports/retraits) and their weights within a month.
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mois_fin date not null,
  date_flux date not null,
  montant numeric(15,2) not null,
  poids numeric(10,8),
  flux_pondere numeric(15,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_portfolio_movements_user_mois
  on public.portfolio_movements (user_id, mois_fin desc);
create index if not exists idx_portfolio_movements_user_date_flux
  on public.portfolio_movements (user_id, date_flux desc);

comment on table public.portfolio_movements is
  'Détail des mouvements de flux (apports/retraits) avec poids dans le mois.';

-- ---------------------------------------------------------------------------
-- Table 3: portfolio_positions
-- Current holdings: symbole, secteur, quantité, cours, pondération, liquidités.
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbole varchar(10),
  secteur varchar(50),
  quantite integer default 0,
  cours numeric(10,2) default 0,
  valeur numeric(15,2),
  ponderation numeric(8,6),
  is_liquidites boolean default false,
  updated_at timestamptz not null default now(),
  unique (user_id, symbole)
);

create index if not exists idx_portfolio_positions_user
  on public.portfolio_positions (user_id);
create index if not exists idx_portfolio_positions_user_actif
  on public.portfolio_positions (user_id, is_liquidites desc);

comment on table public.portfolio_positions is
  'Positions actuelles du portefeuille avec pondération et liquidités.';

-- ---------------------------------------------------------------------------
-- Table 4: brvm_reference
-- Reference data for BRVM instruments (public, no user_id).
-- ---------------------------------------------------------------------------
create table if not exists public.brvm_reference (
  symbole varchar(10) primary key,
  nom_entreprise varchar(100),
  secteur varchar(50),
  pays varchar(50)
);

create index if not exists idx_brvm_reference_secteur
  on public.brvm_reference (secteur);

comment on table public.brvm_reference is
  'Référentiel public des instruments BRVM (secteur, pays, nom).';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- --- User-scoped tables (1-3): each user sees only their own data -----------
alter table public.portfolio_monthly_tracking enable row level security;
alter table public.portfolio_movements enable row level security;
alter table public.portfolio_positions enable row level security;

-- Table 1: portfolio_monthly_tracking
drop policy if exists "portfolio_monthly_tracking: proprietaire seul - select" on public.portfolio_monthly_tracking;
create policy "portfolio_monthly_tracking: proprietaire seul - select"
  on public.portfolio_monthly_tracking for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "portfolio_monthly_tracking: proprietaire seul - insert" on public.portfolio_monthly_tracking;
create policy "portfolio_monthly_tracking: proprietaire seul - insert"
  on public.portfolio_monthly_tracking for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "portfolio_monthly_tracking: proprietaire seul - update" on public.portfolio_monthly_tracking;
create policy "portfolio_monthly_tracking: proprietaire seul - update"
  on public.portfolio_monthly_tracking for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "portfolio_monthly_tracking: proprietaire seul - delete" on public.portfolio_monthly_tracking;
create policy "portfolio_monthly_tracking: proprietaire seul - delete"
  on public.portfolio_monthly_tracking for delete to authenticated
  using (user_id = auth.uid());

-- Table 2: portfolio_movements
drop policy if exists "portfolio_movements: proprietaire seul - select" on public.portfolio_movements;
create policy "portfolio_movements: proprietaire seul - select"
  on public.portfolio_movements for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "portfolio_movements: proprietaire seul - insert" on public.portfolio_movements;
create policy "portfolio_movements: proprietaire seul - insert"
  on public.portfolio_movements for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "portfolio_movements: proprietaire seul - update" on public.portfolio_movements;
create policy "portfolio_movements: proprietaire seul - update"
  on public.portfolio_movements for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "portfolio_movements: proprietaire seul - delete" on public.portfolio_movements;
create policy "portfolio_movements: proprietaire seul - delete"
  on public.portfolio_movements for delete to authenticated
  using (user_id = auth.uid());

-- Table 3: portfolio_positions
drop policy if exists "portfolio_positions: proprietaire seul - select" on public.portfolio_positions;
create policy "portfolio_positions: proprietaire seul - select"
  on public.portfolio_positions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "portfolio_positions: proprietaire seul - insert" on public.portfolio_positions;
create policy "portfolio_positions: proprietaire seul - insert"
  on public.portfolio_positions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "portfolio_positions: proprietaire seul - update" on public.portfolio_positions;
create policy "portfolio_positions: proprietaire seul - update"
  on public.portfolio_positions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "portfolio_positions: proprietaire seul - delete" on public.portfolio_positions;
create policy "portfolio_positions: proprietaire seul - delete"
  on public.portfolio_positions for delete to authenticated
  using (user_id = auth.uid());

-- --- Public reference table (4): no RLS needed (no user_id column) ----------
-- brvm_reference is public reference data; no RLS policies required.
-- Read access is unrestricted; write access is service_role only (implicit).
