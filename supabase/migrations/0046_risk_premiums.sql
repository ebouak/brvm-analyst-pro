-- ============================================================================
-- 0042_risk_premiums.sql
-- Primes de risque actions / pays UEMOA — brique du module Valorisation DCF.
-- Donnée de MARCHÉ (aucune donnée personnelle → impact RGPD nul).
-- Additif : ne touche aucune table existante.
--
-- Source des primes : Aswath Damodaran (NYU Stern), « Country Default Spreads
-- and Risk Premiums », table du 5 janvier 2026. Mature market ERP = 4,23 %.
-- ERP total = mature ERP + Country Risk Premium.
-- Source des taux d'IS : taux statutaire de l'impôt sur les sociétés par pays.
-- N'INVENTE RIEN : chaque ligne porte sa source et sa date ; valeurs éditables
-- en console admin (permission existante).
-- ============================================================================

create table if not exists public.risk_premiums (
  pays               text primary key,           -- nom FR du pays
  iso2               varchar(2),                  -- code ISO (CI, SN, …)
  moody_rating       varchar(8),                  -- notation souveraine Moody's (NR si non noté)
  default_spread     numeric(6,4) not null,       -- spread de défaut souverain (décimal, ex. 0.0256)
  country_risk_prem  numeric(6,4) not null,       -- CRP (décimal)
  equity_risk_prem   numeric(6,4) not null,       -- ERP total = mature ERP + CRP (décimal)
  taux_is            numeric(5,4),                -- taux d'IS statutaire (décimal), null = inconnu
  source             text not null,
  date_maj           date not null,
  updated_at         timestamptz not null default now()
);

comment on table public.risk_premiums is
  'Primes de risque actions/pays UEMOA (source Damodaran + IS statutaire). Alimente le module Valorisation DCF (WACC/MEDAF).';

-- Seed Damodaran (table 05/01/2026, mature ERP 4,23 %) + IS statutaire national.
insert into public.risk_premiums
  (pays, iso2, moody_rating, default_spread, country_risk_prem, equity_risk_prem, taux_is, source, date_maj)
values
  ('Côte d''Ivoire', 'CI', 'Ba2',  0.0256, 0.0390, 0.0813, 0.2500, 'Damodaran (NYU) 2026-01-05 ; IS statutaire 25%', '2026-01-05'),
  ('Sénégal',        'SN', 'Caa1', 0.0637, 0.0971, 0.1394, 0.3000, 'Damodaran (NYU) 2026-01-05 ; IS statutaire 30%', '2026-01-05'),
  ('Bénin',          'BJ', 'B1',   0.0383, 0.0583, 0.1006, 0.3000, 'Damodaran (NYU) 2026-01-05 ; IS statutaire 30%', '2026-01-05'),
  ('Burkina Faso',   'BF', 'Caa1', 0.0637, 0.0971, 0.1394, 0.2750, 'Damodaran (NYU) 2026-01-05 ; IS statutaire 27,5%', '2026-01-05'),
  ('Mali',           'ML', 'Caa2', 0.0765, 0.1166, 0.1589, 0.3000, 'Damodaran (NYU) 2026-01-05 ; IS statutaire 30%', '2026-01-05'),
  ('Niger',          'NE', 'Caa3', 0.0850, 0.1295, 0.1718, 0.3000, 'Damodaran (NYU) 2026-01-05 ; IS statutaire 30%', '2026-01-05'),
  ('Togo',           'TG', 'B3',   0.0552, 0.0841, 0.1264, 0.2700, 'Damodaran (NYU) 2026-01-05 ; IS statutaire 27%', '2026-01-05'),
  ('Guinée-Bissau',  'GW', 'NR',   0.0637, 0.0971, 0.1394, 0.2500, 'Damodaran (NYU) 2026-01-05 (proxy non noté) ; IS statutaire 25%', '2026-01-05')
on conflict (pays) do nothing;

-- RLS : lecture publique (donnée de marché), pas d'écriture côté anon.
alter table public.risk_premiums enable row level security;
drop policy if exists "lecture publique risk_premiums" on public.risk_premiums;
create policy "lecture publique risk_premiums" on public.risk_premiums for select using (true);
