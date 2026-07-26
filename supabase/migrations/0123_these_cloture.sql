-- 0123 — Cloture et bilan a posteriori des theses d'investissement.
--
-- Etend investment_theses (0051) plutot que de creer une table parallele.
-- L'archive historisee exige de lever unique(user_id, code) : sinon on ne
-- pourrait pas rouvrir une these apres cloture. On la remplace par un index
-- PARTIEL : une seule these active par titre, autant de cloturees qu'on veut.

alter table public.investment_theses
  add column if not exists statut        text not null default 'active'
       check (statut in ('active','cloturee')),
  add column if not exists verdict       text
       check (verdict in ('jouee','invalidee','abandonnee')),
  add column if not exists bilan         text,
  add column if not exists cours_cloture numeric(18,4),
  add column if not exists cloturee_le   timestamptz;

alter table public.investment_theses
  drop constraint if exists investment_theses_user_id_code_key;

create unique index if not exists uniq_these_active
  on public.investment_theses (user_id, code) where statut = 'active';

comment on column public.investment_theses.statut is
  'active = these en cours (une seule par titre) ; cloturee = archivee avec bilan.';
comment on column public.investment_theses.verdict is
  'A la cloture : jouee (these validee) | invalidee | abandonnee.';
