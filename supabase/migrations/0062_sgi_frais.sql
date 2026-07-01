-- 0062_sgi_frais.sql
-- Barèmes de frais par SGI pour le calculateur de coût réel (/comparateur-sgi).
-- Modèle de confiance à 3 niveaux (jamais de donnée présentée plus fiable
-- qu'elle ne l'est) : homologue_crepmf (lu dans une décision d'homologation
-- individuelle) > agrege_public (agrégé de sources publiques, à confirmer)
-- > saisie_utilisateur (aucune donnée publique, saisie manuelle).
--
-- `sgi_nom` est une clé texte libre correspondant EXACTEMENT aux noms déjà
-- utilisés dans components/landing/SgiComparator.tsx (pas de migration de
-- l'annuaire vers une table dédiée — décision v1 maintenue).
--
-- RGPD : aucune donnée personnelle (barèmes publics par établissement).

create table if not exists public.sgi_frais (
  id                          uuid primary key default gen_random_uuid(),
  sgi_nom                     text not null unique,

  -- Courtage (appliqué à l'achat ET à la vente)
  courtage_pct_min            numeric(5,3),
  courtage_pct_max            numeric(5,3),
  minimum_perception          numeric(12,2),

  -- Conservation / droits de garde
  droits_garde_pct_min        numeric(5,3),
  droits_garde_pct_max        numeric(5,3),
  droits_garde_frequence      text check (droits_garde_frequence in ('annuel','trimestriel','semestriel')),

  -- Tenue de compte
  tenue_compte_montant        numeric(12,2),
  tenue_compte_frequence      text check (tenue_compte_frequence in ('annuel','trimestriel')),

  -- Autres
  frais_virement               numeric(12,2),
  depot_minimum                numeric(12,2),
  gestion_sous_mandat_pct_min  numeric(5,3),
  gestion_sous_mandat_pct_max  numeric(5,3),

  -- Traçabilité / confiance
  confiance                    text not null default 'agrege_public'
                                check (confiance in ('homologue_crepmf','agrege_public','saisie_utilisateur')),
  source_url                   text,
  source_label                 text,
  verifie_le                   date,
  notes                        text,

  updated_at                   timestamptz not null default now()
);

create index if not exists idx_sgi_frais_nom on public.sgi_frais (sgi_nom);

alter table public.sgi_frais enable row level security;

drop policy if exists sgi_frais_public_read on public.sgi_frais;
create policy sgi_frais_public_read on public.sgi_frais
  for select using (true);

comment on table public.sgi_frais is
  'Barèmes de frais par SGI (calculateur de coût /comparateur-sgi). Écriture réservée au service_role / admin content.write.';
