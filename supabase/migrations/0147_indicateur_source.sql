-- 0147 — Observations sourcées des indicateurs prudentiels bancaires.
--
-- Une ligne = UNE valeur observée dans UN document (ou l'absence constatée
-- d'une valeur). Les colonnes de lignes_specifiques restent la « valeur
-- retenue » lue par le site ; elles seront alimentées depuis cette table par
-- une règle de sélection explicite et testée (scraper), jamais l'inverse.
--
-- Pourquoi une table et non quelques colonnes de plus dans correction_champ :
-- correction_champ journalise des ÉCRITURES. Ici il faut garder aussi ce qui
-- n'est PAS écrit — une observation contradictoire, un document d'une autre
-- période, un « non trouvé » — pour pouvoir le justifier.
--
-- Règles métier (2026-10-07) :
--   * statut distingue « non applicable », « non trouvé dans les documents
--     consultés » et « publié mais non exploitable » ; valeur NULL dans ces
--     trois cas, jamais 0.
--   * solvabilité totale, CET1 et Tier 1 sont des indicateurs DISTINCTS.
--   * créances en souffrance : montant brut, taux et couverture sont distincts ;
--     la définition lue est conservée (PCB « créances en souffrance » et IFRS
--     « créances douteuses » ne se fusionnent pas).
--   * le périmètre non écrit dans le document reste « non_precise » ; une
--     valeur propre à une branche d'activité ou à une autre filiale n'entre
--     pas (ex. créances de la branche islamique de Coris).
--   * une borne publiée se garde comme borne : comparateur '>' et valeur 14,
--     jamais la valeur exacte d'un autre exercice reportée.

create table if not exists public.indicateur_source (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null,
  indicateur            text not null check (indicateur in (
                          'solvabilite_total', 'ratio_cet1', 'ratio_tier1', 'ratio_levier',
                          'ratio_liquidite',
                          'creances_souffrance_brutes', 'taux_creances_souffrance',
                          'couverture_creances_souffrance',
                          -- Distincts des créances en souffrance : ne jamais les fusionner
                          -- (SIB 2021 : sinistralité 9,39 % = CDL 4,55 % + restructurées 4,84 %).
                          'taux_creances_restructurees', 'taux_sinistralite')),
  date_arrete           date,
  perimetre             text not null default 'non_precise'
                          check (perimetre in ('individuel', 'consolide', 'non_precise')),
  statut                text not null check (statut in (
                          'publie', 'non_applicable', 'non_trouve', 'publie_non_exploitable')),
  valeur                numeric,
  -- Une borne publiée (« supérieur à 14 % ») n'est pas une valeur exacte.
  comparateur           text not null default '=' check (comparateur in ('=', '>', '>=', '<', '<=')),
  unite                 text check (unite in ('pct', 'fcfa', 'millions_fcfa', 'milliers_fcfa', 'usd', 'millions_usd')),
  -- Le document
  emetteur_lu           text,
  document_url          text not null,
  document_libelle      text,
  document_date         date,
  remplace_document_url text,
  page                  integer,
  libelle_exact         text,
  definition            text,
  -- L'extraction
  methode               text not null,
  modele                text,
  verifie_par           text,
  verifie_le            timestamptz,
  commentaire           text,
  cree_le               timestamptz not null default now(),
  -- Une valeur publiée porte un nombre ; les trois autres statuts, jamais.
  constraint indicateur_source_valeur_statut check (
    (statut = 'publie' and valeur is not null and unite is not null)
    or (statut <> 'publie' and valeur is null)
  ),
  unique (code, indicateur, date_arrete, perimetre, document_url)
);

comment on table public.indicateur_source is
  'Observations sourcées des indicateurs prudentiels bancaires : une ligne par valeur (ou absence constatée) par document. lignes_specifiques garde la valeur retenue.';
comment on column public.indicateur_source.statut is
  'publie = valeur lue ; non_applicable = sans objet pour cet émetteur ; non_trouve = absente des documents consultés (pas de toutes les publications) ; publie_non_exploitable = présente mais illisible, ambiguë ou sans dénominateur compatible.';
comment on column public.indicateur_source.remplace_document_url is
  'Document que celui-ci annule et remplace (« annule et remplace le précédent »), pour la piste d''audit.';
comment on column public.indicateur_source.verifie_par is
  'NULL = extraction automatique non relue. Renseigné quand une personne a contrôlé libellé, unité, signe et période.';

create index if not exists idx_indicateur_source_code
  on public.indicateur_source (code, indicateur, date_arrete desc);

alter table public.indicateur_source enable row level security;

-- Données de marché, aucune donnée personnelle : lecture publique (comme
-- provenance_exercice). Écriture réservée au service_role.
drop policy if exists "indicateur_source lecture publique" on public.indicateur_source;
create policy "indicateur_source lecture publique" on public.indicateur_source
  for select using (true);

-- Révoquer anon ET authenticated : révoquer PUBLIC ne retire pas les grants
-- nominatifs posés par Supabase (leçon de 0093).
revoke insert, update, delete on public.indicateur_source from anon, authenticated;
