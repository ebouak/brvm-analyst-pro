-- ============================================================================
-- 0072_diagnostic_red_flags.sql — Détecteur de red flags (9e section du
-- Diagnostic IA) : score de gravité stocké + cache de recherche web (Tavily).
-- ============================================================================

alter table public.diagnostic_reports
  add column if not exists red_flag_score smallint
    check (red_flag_score between 0 and 10);

create table if not exists public.diagnostic_search_cache (
  code text not null references public.brvm_instruments(code) on update cascade,
  category text not null check (category in ('litiges', 'insiders', 'concentration_client')),
  results jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (code, category)
);

alter table public.diagnostic_search_cache enable row level security;

drop policy if exists "lecture publique diagnostic_search_cache" on public.diagnostic_search_cache;
create policy "lecture publique diagnostic_search_cache"
  on public.diagnostic_search_cache for select
  using (true);

drop policy if exists "ecriture service_role diagnostic_search_cache" on public.diagnostic_search_cache;
create policy "ecriture service_role diagnostic_search_cache"
  on public.diagnostic_search_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
