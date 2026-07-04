-- supabase/migrations/0069_african_indices.sql
-- Indices boursiers pan-africains (Ghana GSE-CI, Nigeria NGX ASI, Kenya NSE NASI)
-- collectés par le scraper depuis AFX (afx.kwayisi.org, source publique).
-- Positionnement : WESTBOURSE = référence UEMOA **et** vue régionale diaspora.
-- Données de référence publiques, aucune donnée personnelle (pas de volet RGPD).

create table if not exists public.african_indices_daily (
  code           text not null,             -- 'GSECI' | 'NGXASI' | 'NSENASI'
  date_marche    date not null,             -- jour de la valeur (heure de la place)
  libelle        text not null,
  place          text not null,             -- 'Ghana' | 'Nigeria' | 'Kenya'
  devise         text,                      -- devise du market cap (GHS/NGN/KES)
  valeur         numeric not null,
  variation_pts  numeric,                   -- variation du jour en points
  variation_pct  numeric,                   -- dérivée des points (pts / veille)
  ytd_pct        numeric,                   -- performance depuis le 1er janvier
  market_cap     text,                      -- tel qu'affiché (ex. 'NGN 147.11Tr')
  source         text not null default 'afx.kwayisi.org',
  captured_at    timestamptz not null default now(),
  primary key (code, date_marche)
);

create index if not exists idx_african_indices_code_date
  on public.african_indices_daily (code, date_marche desc);

comment on table public.african_indices_daily is
  'Indices pan-africains (GSE, NGX, NSE) — upsert idempotent (code, date_marche), source AFX.';

alter table public.african_indices_daily enable row level security;

drop policy if exists "lecture publique african_indices" on public.african_indices_daily;
create policy "lecture publique african_indices"
  on public.african_indices_daily for select
  using (true);

drop policy if exists "ecriture service_role african_indices" on public.african_indices_daily;
create policy "ecriture service_role african_indices"
  on public.african_indices_daily for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
