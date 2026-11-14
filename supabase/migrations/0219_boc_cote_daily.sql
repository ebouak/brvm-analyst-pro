-- 0219 — Cote officielle par valeur, issue du Bulletin Officiel de la Cote.
--
-- Pourquoi : l'audit du 2026-11-13 a comparé les ratios du site au bulletin du
-- 09/11. Cinq PER s'en écartaient (SEMC, SDCC, CABC, TTLS, ONTBF), et deux
-- valeurs SUSPENDUES (SEMC, SICC, « SP » au bulletin) étaient affichées comme
-- cotées, avec RSI et MACD calculés sur un cours figé. Aucune table ne gardait
-- ce que la BRVM publie pour chaque valeur.
--
-- Usage : référence du contrôle quotidien des écarts (frontend/lib/boc/ecarts.ts,
-- route /api/cron/controle-boc) et source du badge « BOC » sur la fiche.
-- Les valeurs de cette table ne REMPLACENT aucun ratio calculé : elles le
-- recoupent. Un écart se signale, il ne se corrige pas en silence.
--
-- Décalage assumé : le bulletin d'une séance paraît après la clôture, parfois
-- le lendemain. La table porte TOUJOURS sa date de séance ; l'interface
-- l'affiche avec cette date.
--
-- Pas de clé étrangère vers brvm_instruments : une admission à la cote (BBGC,
-- 24/09) ferait rejeter tout le lot (voir CLAUDE.md, passage 2026-09-24).
--
-- RGPD : aucune donnée personnelle. Donnée de marché publique, lecture ouverte
-- comme brvm_carnet_daily.

create table if not exists public.boc_cote_daily (
  code              text not null check (code ~ '^[A-Z][A-Z0-9]{2,5}$'),
  date_marche       date not null,
  statut            text not null check (statut in ('cote', 'suspendu')),
  -- NULL quand la valeur est suspendue : le bulletin écrit « SP », pas un cours.
  cours_cloture     numeric check (cours_cloture is null or cours_cloture > 0),
  cours_reference   numeric check (cours_reference is null or cours_reference > 0),
  -- PER publié par la BRVM, tel quel (il peut être négatif ou très élevé).
  per               numeric,
  rendement_net_pct numeric,
  dividende_net     numeric check (dividende_net is null or dividende_net > 0),
  dividende_date    date,
  source_url        text not null,
  collecte_at       timestamptz not null default now(),
  primary key (code, date_marche),
  constraint boc_cote_suspendu_sans_cloture check (statut = 'cote' or cours_cloture is null)
);

comment on table public.boc_cote_daily is
  'Cote officielle par valeur et par séance (statut, clôture, référence, PER, dernier dividende net). Source : Bulletin Officiel de la Cote (BRVM). Sert de référence au contrôle des écarts, ne remplace aucun ratio calculé.';
comment on column public.boc_cote_daily.statut is
  '« suspendu » quand le bulletin écrit SP à la place des cours.';

create index if not exists boc_cote_daily_date_idx on public.boc_cote_daily (date_marche desc);

alter table public.boc_cote_daily enable row level security;

drop policy if exists "boc_cote_daily_public_read" on public.boc_cote_daily;
create policy "boc_cote_daily_public_read"
  on public.boc_cote_daily for select
  to anon, authenticated
  using (true);

-- Aucune policy d'écriture : seul le collecteur, porteur de la clé de service,
-- alimente cette table.
