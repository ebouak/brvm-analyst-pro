-- 0096 — Inflation annuelle des 8 pays de l'UEMOA.
--
-- POURQUOI : un rendement nominal ne dit rien. +3 % sur une année à 9 %
-- d'inflation, c'est une PERTE de pouvoir d'achat. Aucune donnée d'inflation
-- n'existait en base (`macro_indicators` ne contient que les taux directeurs
-- BCEAO) — impossible de dire à l'investisseur si son gain est réel.
--
-- SOURCE : API de la Banque mondiale, indicateur FP.CPI.TOTL.ZG
-- (« Inflation, consumer prices, annual % »). Publique, gratuite, sans clé.
-- Recoupée avec le chiffre UEMOA publié par la BCEAO (~0 % en 2025) : concordant.
-- On ne fabrique JAMAIS un chiffre : si l'API ne renvoie rien pour une année,
-- la ligne n'existe pas et l'écran affiche « donnée indisponible ».

create table if not exists public.macro_inflation (
  pays_code   text    not null,          -- ISO3 : CIV, SEN, BEN…
  pays_nom    text    not null,
  annee       integer not null,
  taux_pct    numeric not null,          -- inflation annuelle en %
  source      text    not null default 'World Bank (FP.CPI.TOTL.ZG)',
  source_url  text,
  updated_at  timestamptz not null default now(),
  primary key (pays_code, annee)         -- clé naturelle => upsert idempotent
);

comment on table public.macro_inflation is
  'Inflation annuelle (IPC) des pays UEMOA. Source : API Banque mondiale. Sert au calcul du rendement réel.';

create index if not exists idx_macro_inflation_annee on public.macro_inflation (annee desc);

-- Donnée publique et non personnelle : lecture ouverte, écriture réservée au
-- service_role (le scraper). Pas de policy d'écriture => personne d'autre n'écrit.
alter table public.macro_inflation enable row level security;

drop policy if exists macro_inflation_read on public.macro_inflation;
create policy macro_inflation_read
  on public.macro_inflation
  for select
  using (true);
