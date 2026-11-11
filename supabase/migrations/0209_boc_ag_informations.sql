-- 0209 — Calendrier des AG et page « Informations » du Bulletin Officiel de la Cote.
--
-- Pourquoi : une AG n'existait chez nous que par l'avis de convocation publié
-- par la société, daté du jour de sa PUBLICATION. L'agenda du tableau de bord
-- laissait donc les assemblées vides. Le bulletin quotidien de la BRVM publie
-- la date, l'heure, la nature et le lieu de chaque AG de l'année, ainsi que les
-- opérations en cours, les avis et les communiqués. Le collecteur
-- (`scraper/src/boc/`, CLI `boc:infos`) les range ici.
--
-- Une ligne est reprise d'un bulletin à l'autre (le calendrier des AG est
-- CUMULATIF sur l'année ; une opération reste listée tant qu'elle court).
-- `premier_bulletin` / `dernier_bulletin` disent quand elle a été vue :
--   - une AG future absente du dernier bulletin lu a été retirée ou reportée ;
--   - une opération est « en cours » si elle figure dans le dernier bulletin.
--
-- Pas de clé étrangère vers brvm_instruments : une AG ou un avis d'un émetteur
-- encore inconnu (admission à la cote, émetteur obligataire) doit pouvoir
-- s'enregistrer seul (leçon BBGC du 2026-09-24). `code` est NULL quand le nom
-- publié n'est pas dans la table curée `scraper/src/boc/noms.ts`.
--
-- RGPD : aucune donnée personnelle. Données publiques de la BRVM, lecture
-- ouverte comme brvm_carnet_daily. Écriture : service_role seul.

-- ── Assemblées générales ──────────────────────────────────────────────────
create table if not exists public.boc_assemblees (
  cle              text primary key,          -- empreinte de (société, date, nature)
  code             text,                      -- NULL si nom non rapproché
  societe          text not null,             -- nom tel que publié
  nature           text not null,             -- libellé publié (« Ordinaire »)
  nature_cle       text not null check (nature_cle in ('ordinaire', 'extraordinaire', 'mixte', 'autre')),
  date_ag          date not null,             -- date de la RÉUNION
  heure            time,
  lieu             text,
  premier_bulletin date not null,
  dernier_bulletin date not null,
  collecte_at      timestamptz not null default now(),
  constraint boc_assemblees_bulletins check (dernier_bulletin >= premier_bulletin)
);

comment on table public.boc_assemblees is
  'Calendrier des assemblées générales publié par la BRVM dans le Bulletin Officiel de la Cote. date_ag = date de la réunion.';

create index if not exists boc_assemblees_date_idx on public.boc_assemblees (date_ag);
create index if not exists boc_assemblees_code_idx on public.boc_assemblees (code, date_ag desc);
create index if not exists boc_assemblees_dernier_idx on public.boc_assemblees (dernier_bulletin desc);

-- ── Opérations en cours ───────────────────────────────────────────────────
create table if not exists public.boc_operations (
  cle              text primary key,          -- empreinte de (émetteur, texte)
  emetteur         text not null,
  code             text,
  operation        text not null,
  type_operation   text not null check (type_operation in (
    'premiere_cotation', 'dividende', 'interets', 'remboursement', 'augmentation_capital',
    'fractionnement', 'offre_publique', 'radiation', 'suspension', 'autre')),
  date_operation   date,                      -- échéance écrite dans le texte, si présente
  premier_bulletin date not null,
  dernier_bulletin date not null,
  collecte_at      timestamptz not null default now(),
  constraint boc_operations_bulletins check (dernier_bulletin >= premier_bulletin)
);

comment on table public.boc_operations is
  'Section « Opérations en cours » du Bulletin Officiel de la Cote. Texte tel que publié ; date_operation lue dans le texte, jamais estimée.';

create index if not exists boc_operations_date_idx on public.boc_operations (date_operation);
create index if not exists boc_operations_code_idx on public.boc_operations (code);
create index if not exists boc_operations_dernier_idx on public.boc_operations (dernier_bulletin desc);

-- ── Avis et communiqués ───────────────────────────────────────────────────
create table if not exists public.boc_avis (
  cle            text primary key,            -- empreinte de (catégorie, entité, numéro)
  categorie      text not null check (categorie in ('avis', 'communique')),
  entite         text not null,
  code           text,
  numero         text,                        -- « 277-2026 »
  nature         text,
  objet          text not null,
  date_bulletin  date not null,               -- premier bulletin où il paraît
  collecte_at    timestamptz not null default now()
);

comment on table public.boc_avis is
  'Sections « Avis » (BRVM) et « Communiqués » (émetteurs) du Bulletin Officiel de la Cote.';

create index if not exists boc_avis_date_idx on public.boc_avis (date_bulletin desc);
create index if not exists boc_avis_code_idx on public.boc_avis (code, date_bulletin desc);

-- ── Journal des bulletins lus ─────────────────────────────────────────────
-- Rend le collecteur idempotent (un bulletin lu n'est pas relu sans --forcer)
-- et garde trace de ce qui n'a PAS été rapproché ou lu : un trou nommé.
create table if not exists public.boc_bulletins_lus (
  date_bulletin   date primary key,
  url             text,
  nb_assemblees   int not null default 0,
  nb_operations   int not null default 0,
  nb_avis         int not null default 0,
  non_rapproches  text[] not null default '{}',
  rejets          text[] not null default '{}',
  lu_at           timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.boc_assemblees    enable row level security;
alter table public.boc_operations    enable row level security;
alter table public.boc_avis          enable row level security;
alter table public.boc_bulletins_lus enable row level security;

drop policy if exists boc_assemblees_lecture on public.boc_assemblees;
create policy boc_assemblees_lecture on public.boc_assemblees for select to anon, authenticated using (true);
drop policy if exists boc_operations_lecture on public.boc_operations;
create policy boc_operations_lecture on public.boc_operations for select to anon, authenticated using (true);
drop policy if exists boc_avis_lecture on public.boc_avis;
create policy boc_avis_lecture on public.boc_avis for select to anon, authenticated using (true);
-- boc_bulletins_lus : AUCUNE policy. Journal d'exploitation, service_role seul.

-- Supabase accorde par défaut tous les droits à anon/authenticated : sans
-- policy d'écriture la RLS les bloque déjà, on les retire quand même (0093).
revoke insert, update, delete, truncate on public.boc_assemblees    from anon, authenticated;
revoke insert, update, delete, truncate on public.boc_operations    from anon, authenticated;
revoke insert, update, delete, truncate on public.boc_avis          from anon, authenticated;
revoke all                              on public.boc_bulletins_lus from anon, authenticated;
