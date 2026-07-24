-- 0120 — Passeport de donnée : traçabilité des fondamentaux publiés.
--
-- Granularité par EXERCICE et non par champ : tous les chiffres d'un exercice
-- proviennent du même PDF, extraits par la même passe, avec la même confiance.
-- Le champ par champ ne garde sa valeur que pour les corrections ponctuelles,
-- d'où la seconde table.
--
-- Voir docs/superpowers/specs/2026-07-23-passeport-donnee-design.md

create table if not exists public.provenance_exercice (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  periode         text not null,
  table_cible     text not null check (table_cible in
                    ('income_statements','balance_sheets','cash_flow_statements')),
  publication_id  uuid references public.publications(id) on delete set null,
  extrait_le      timestamptz,
  extracteur      text,
  confiance       text not null default 'non_trace'
                    check (confiance in ('verifie','extrait','non_trace')),
  created_at      timestamptz not null default now(),
  unique (code, periode, table_cible)
);

comment on table public.provenance_exercice is
  'D''où vient un exercice financier : document source, passe d''extraction, niveau de confiance. Une ligne par (code, période, table).';
comment on column public.provenance_exercice.confiance is
  'verifie = recoupé contre une source externe citée ; extrait = extraction automatique ayant passé les garde-fous ; non_trace = provenance inconnue (affiché tel quel, jamais deviné).';

create index if not exists idx_provenance_code_periode
  on public.provenance_exercice (code, periode);

-- Corrections manuelles. STOCKÉ mais NON exposé (décision de cadrage) : l'actif
-- se constitue, l'affichage pourra être ouvert plus tard sans rien reconstruire.
create table if not exists public.correction_champ (
  id             uuid primary key default gen_random_uuid(),
  table_cible    text not null check (table_cible in
                   ('income_statements','balance_sheets','cash_flow_statements')),
  code           text not null,
  periode        text not null,
  champ          text not null,
  valeur_avant   numeric,
  valeur_apres   numeric,
  motif          text not null,
  source_externe text,
  corrige_le     timestamptz not null default now(),
  corrige_par    text
);

comment on column public.correction_champ.source_externe is
  'Source externe ayant permis de trancher (Sika Finance, Madis Invest, publication émetteur). NULL = correction technique interne, qui ne promeut PAS la confiance : réparer une erreur ne vérifie rien.';

create index if not exists idx_correction_code_periode
  on public.correction_champ (code, periode);

alter table public.provenance_exercice enable row level security;
alter table public.correction_champ    enable row level security;

-- La preuve est l'argument de confiance : lecture publique, aucune donnée personnelle.
drop policy if exists "provenance lecture publique" on public.provenance_exercice;
create policy "provenance lecture publique" on public.provenance_exercice
  for select using (true);

-- Écriture réservée au service_role. Révoquer depuis anon ET authenticated :
-- révoquer PUBLIC ne retire pas les grants nominatifs posés par Supabase.
revoke insert, update, delete on public.provenance_exercice from anon, authenticated;

-- correction_champ : aucune policy de lecture -> invisible hors service_role.
revoke all on public.correction_champ from anon, authenticated;
