-- 0231 — Dossier valeur : instantané des mesures à chaque édition hebdomadaire.
--
-- POURQUOI. L'encadré « Depuis la dernière édition » (page 3 du dossier) compare
-- les mesures d'aujourd'hui à celles de l'édition précédente : variation du
-- cours, publications parues, piliers dont le constat a changé. Sans trace de
-- l'édition précédente, cette comparaison serait reconstituée à la volée avec
-- des données qui ont pu changer depuis (comptes corrigés, notation mise à
-- jour) : on comparerait le dossier d'aujourd'hui à une version de lui-même qui
-- n'a jamais existé. On fige donc ce que l'édition a MESURÉ.
--
-- DONNÉES DE MARCHÉ, PAS DE DONNÉES UTILISATEUR : un instantané ne dépend que du
-- code. Lecture publique (comme dossier_narratifs) ; aucune policy d'écriture :
-- seul service_role écrit, via /api/cron/dossier-instantane.
--
-- INSERT SEUL, jamais de réécriture : la route écrit avec « ignorer les
-- doublons » sur (code, edition). Relancer le workflow à la main ne modifie pas
-- une édition déjà figée.
--
-- `edition` = date de la SÉANCE de référence (la dernière séance cotée au moment
-- de la mesure), pas la date du calcul : deux exécutions entre deux séances
-- décrivent la même édition.
--
-- `version` : schéma de `mesures`. Deux éditions de versions différentes ne se
-- comparent pas (l'encadré est alors absent), plutôt que de comparer des
-- grandeurs qui n'ont plus la même définition.

create table if not exists public.dossier_instantanes (
  code      text        not null,
  edition   date        not null,
  version   int         not null default 1,
  -- v1 : { cours, per, rendement, publications, piliers: { <cle>: <statut> } }
  mesures   jsonb       not null,
  cree_le   timestamptz not null default now(),
  primary key (code, edition)
);

comment on table public.dossier_instantanes is
  'Mesures figées de chaque édition hebdomadaire du dossier valeur (insert seul). Sert à l''encadré « Depuis la dernière édition ».';

alter table public.dossier_instantanes enable row level security;

drop policy if exists "dossier_instantanes lecture publique" on public.dossier_instantanes;
create policy "dossier_instantanes lecture publique"
  on public.dossier_instantanes for select
  to anon, authenticated
  using (true);

-- Aucune policy insert/update/delete : seul service_role (qui contourne la RLS) écrit.
-- Révocation explicite des privilèges de table : Supabase accorde par défaut ALL aux
-- rôles anon/authenticated (grants nominatifs), que la RLS seule ne retire pas.
revoke insert, update, delete, truncate on public.dossier_instantanes from anon, authenticated;
