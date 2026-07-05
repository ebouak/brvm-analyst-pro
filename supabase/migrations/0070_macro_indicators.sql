-- supabase/migrations/0070_macro_indicators.sql
-- Indicateurs macro UEMOA (taux BCEAO, parité fixe) pour le bandeau dashboard.
-- Valeurs de référence publiques, mises à jour rarement (décisions BCEAO) —
-- éditables via SQL/service_role, chaque ligne porte sa source et sa date.
-- Aucune donnée personnelle (pas de volet RGPD).

create table if not exists public.macro_indicators (
  key         text primary key,
  label       text not null,
  value       numeric not null,
  unit        text not null default '%',
  as_of       date not null,           -- date d'effet / de constat de la valeur
  source_url  text,
  updated_at  timestamptz not null default now()
);

comment on table public.macro_indicators is
  'Indicateurs macro UEMOA (taux directeurs BCEAO, parité EUR/XOF) — source officielle par ligne.';

alter table public.macro_indicators enable row level security;

drop policy if exists "lecture publique macro_indicators" on public.macro_indicators;
create policy "lecture publique macro_indicators"
  on public.macro_indicators for select using (true);

drop policy if exists "ecriture service_role macro_indicators" on public.macro_indicators;
create policy "ecriture service_role macro_indicators"
  on public.macro_indicators for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Seed — valeurs relevées sur bceao.int le 2026-07-05 (section « Taux directeurs »).
insert into public.macro_indicators (key, label, value, unit, as_of, source_url) values
  ('bceao_taux_directeur', 'Taux directeur BCEAO', 3.00, '%', '2026-03-16', 'https://www.bceao.int/'),
  ('bceao_guichet_marginal', 'Guichet de prêt marginal BCEAO', 5.00, '%', '2026-03-16', 'https://www.bceao.int/'),
  ('eur_xof', 'Parité EUR/XOF (fixe)', 655.957, 'FCFA', '1999-01-01', 'https://www.bceao.int/')
on conflict (key) do update set
  label = excluded.label, value = excluded.value, unit = excluded.unit,
  as_of = excluded.as_of, source_url = excluded.source_url, updated_at = now();
