-- ============================================================================
-- 0063_sgi_directory_and_frais_extend.sql
-- Enrichissement SGI — brique 1 (socle) :
--   1) ajoute la colonne du plancher de garde à sgi_frais (0062) ;
--   2) crée la table d'annuaire sgi_directory (pays, type, contacts, liens).
-- Donnée d'ANNUAIRE PUBLIC d'établissements agréés (coordonnées professionnelles,
-- pas de personne physique) → impact RGPD faible, base légale intérêt légitime.
-- Additif : ne casse aucune table existante.
-- ============================================================================

-- 1) sgi_frais : plancher de garde (miroir du minimum de perception du courtage).
--    if not exists car la table 0062 peut déjà être appliquée en prod.
alter table public.sgi_frais
  add column if not exists droits_garde_minimum numeric(12,2);

comment on column public.sgi_frais.droits_garde_minimum is
  'Plancher par période des droits de garde (ex. 2 500 FCFA/trimestre) — remplace le taux proportionnel s''il est plus élevé, comme minimum_perception pour le courtage.';

-- 2) Annuaire des SGI (pays/type/groupe/contacts/liens). Clé naturelle = nom.
create table if not exists public.sgi_directory (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null unique,          -- correspond à sgi_frais.sgi_nom
  pays             varchar(2),                    -- code ISO2 UEMOA (CI, SN, BF, ML, BJ, TG, NE)
  type             text check (type in ('Banque','Indépendante','Non déterminé')),
  groupe           text,                          -- affiliation / groupe ('Non renseigné' si inconnu)
  logo             text,                          -- chemin logo /public (optionnel)
  depot_min        text,                          -- libellé lisible ('≈ 100 000 FCFA', 'Aucun', 'Non renseigné')
  depot_min_source text check (depot_min_source in ('indicatif','relevé','inconnu')),
  site_web         text,
  fiche_brvm       text,
  telephone        text,                          -- coordonnée professionnelle publique
  email            text,                          -- coordonnée professionnelle publique
  source           text not null default 'manuel' -- 'manuel' | 'richbourse'
                     check (source in ('manuel','richbourse')),
  verifie_le       date,
  updated_at       timestamptz not null default now()
);

create index if not exists idx_sgi_directory_pays on public.sgi_directory (pays);

comment on table public.sgi_directory is
  'Annuaire des SGI agréées BRVM/UEMOA (pays, type, groupe, contacts, liens). Écriture réservée service_role (scraper) / admin content.write. Lecture publique.';

-- RLS : lecture publique (annuaire public), aucune écriture côté anon.
alter table public.sgi_directory enable row level security;
drop policy if exists sgi_directory_public_read on public.sgi_directory;
create policy sgi_directory_public_read on public.sgi_directory
  for select using (true);
