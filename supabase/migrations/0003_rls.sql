-- ============================================================================
-- BRVM Analyst Pro — Row Level Security (cf. §6.6)
--   - Tables marché / référentiel / signaux : LECTURE PUBLIQUE, écriture
--     réservée au service_role (le scraper). Aucune écriture par les users.
--   - Watchlists / portefeuille / alertes : PRIVÉ, chaque user ne voit/écrit
--     que ses propres lignes (user_id = auth.uid()).
-- Le service_role bypass la RLS par conception (utilisé par le scraper backend).
-- ============================================================================

-- --- Données de marché : lecture publique -----------------------------------
alter table public.brvm_instruments        enable row level security;
alter table public.brvm_actions_daily       enable row level security;
alter table public.brvm_obligations_daily   enable row level security;
alter table public.brvm_indices_daily        enable row level security;
alter table public.signals_daily             enable row level security;
alter table public.scrape_runs               enable row level security;

-- Lecture publique (anon + authenticated) sur les données de marché.
drop policy if exists "lecture publique instruments" on public.brvm_instruments;
create policy "lecture publique instruments"
  on public.brvm_instruments for select using (true);

drop policy if exists "lecture publique actions" on public.brvm_actions_daily;
create policy "lecture publique actions"
  on public.brvm_actions_daily for select using (true);

drop policy if exists "lecture publique obligations" on public.brvm_obligations_daily;
create policy "lecture publique obligations"
  on public.brvm_obligations_daily for select using (true);

drop policy if exists "lecture publique indices" on public.brvm_indices_daily;
create policy "lecture publique indices"
  on public.brvm_indices_daily for select using (true);

drop policy if exists "lecture publique signaux" on public.signals_daily;
create policy "lecture publique signaux"
  on public.signals_daily for select using (true);

-- scrape_runs : lecture réservée aux utilisateurs authentifiés (monitoring),
-- pas d'exposition publique des logs techniques.
drop policy if exists "lecture authentifiee scrape_runs" on public.scrape_runs;
create policy "lecture authentifiee scrape_runs"
  on public.scrape_runs for select to authenticated using (true);

-- Aucune policy INSERT/UPDATE/DELETE pour anon/authenticated sur ces tables :
-- seules les écritures via service_role (qui bypass la RLS) sont permises.

-- --- Watchlists (privées) ----------------------------------------------------
alter table public.watchlists        enable row level security;
alter table public.watchlist_items   enable row level security;

drop policy if exists "watchlists: proprietaire seul - select" on public.watchlists;
create policy "watchlists: proprietaire seul - select"
  on public.watchlists for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "watchlists: proprietaire seul - insert" on public.watchlists;
create policy "watchlists: proprietaire seul - insert"
  on public.watchlists for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "watchlists: proprietaire seul - update" on public.watchlists;
create policy "watchlists: proprietaire seul - update"
  on public.watchlists for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "watchlists: proprietaire seul - delete" on public.watchlists;
create policy "watchlists: proprietaire seul - delete"
  on public.watchlists for delete to authenticated
  using (user_id = auth.uid());

-- Items : accès si la watchlist parente appartient à l'utilisateur.
drop policy if exists "watchlist_items: via parent - select" on public.watchlist_items;
create policy "watchlist_items: via parent - select"
  on public.watchlist_items for select to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
  ));

drop policy if exists "watchlist_items: via parent - insert" on public.watchlist_items;
create policy "watchlist_items: via parent - insert"
  on public.watchlist_items for insert to authenticated
  with check (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
  ));

drop policy if exists "watchlist_items: via parent - update" on public.watchlist_items;
create policy "watchlist_items: via parent - update"
  on public.watchlist_items for update to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
  ));

drop policy if exists "watchlist_items: via parent - delete" on public.watchlist_items;
create policy "watchlist_items: via parent - delete"
  on public.watchlist_items for delete to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
  ));

-- --- Portefeuille (privé) ----------------------------------------------------
alter table public.portfolios_positions enable row level security;
drop policy if exists "positions: proprietaire seul - all" on public.portfolios_positions;
create policy "positions: proprietaire seul - all"
  on public.portfolios_positions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --- Alertes (privées) -------------------------------------------------------
alter table public.alerts enable row level security;
drop policy if exists "alerts: proprietaire seul - all" on public.alerts;
create policy "alerts: proprietaire seul - all"
  on public.alerts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
