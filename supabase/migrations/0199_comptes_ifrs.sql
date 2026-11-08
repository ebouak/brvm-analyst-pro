-- 0199 — Comptes IFRS publiés par une société, À CÔTÉ des comptes SYSCOHADA.
--
-- Pourquoi : certains émetteurs (SCRC, …) publient deux jeux de comptes. Les
-- ratios publics restent calculés sur SYSCOHADA (`income_statements` /
-- `balance_sheets`, voir `frontend/lib/fiche/exerciceRetenu.ts`). Cette table
-- porte le second jeu, COMPACT et séparé : on ne touche à aucune table
-- existante, et les deux référentiels ne se mélangent jamais dans un ratio.
--
-- Unités : montants en FCFA (les PDF sont souvent en milliers : convertir à
-- l'écriture, jamais à la lecture).
--
-- Honnêteté : chaque ligne porte sa source (URL du PDF) et la date de
-- vérification. Un poste non lisible avec certitude reste NULL.
--
-- `comparaison_sika` : postes communs comparés avec Sika Finance (qui publie
-- le référentiel SYSCOHADA), valeurs et écarts. Voir les lignes de données.
--
-- RGPD : aucune donnée personnelle (comptes de sociétés cotées). Lecture
-- publique comme `brvm_actions_daily`.

create table if not exists public.comptes_ifrs (
  code                          text not null references public.brvm_instruments(code),
  exercice                      int  not null check (exercice between 1990 and 2100),
  chiffre_affaires              numeric,
  resultat_net                  numeric,
  resultat_net_part_groupe      numeric,
  capitaux_propres              numeric,
  capitaux_propres_part_groupe  numeric,
  total_actif                   numeric,
  dette_financiere              numeric,
  source_url                    text not null,
  source_titre                  text,
  verifie_le                    date not null,
  comparaison_sika              jsonb,
  created_at                    timestamptz not null default now(),
  primary key (code, exercice)
);

comment on table public.comptes_ifrs is
  'Second jeu de comptes (IFRS) publié par une société, en FCFA. Affiché à côté des comptes SYSCOHADA, jamais mélangé dans les ratios principaux.';
comment on column public.comptes_ifrs.dette_financiere is
  'Dettes financières IFRS : emprunts (long et court terme), concours bancaires et passifs locatifs (IFRS 16).';
comment on column public.comptes_ifrs.comparaison_sika is
  'Postes communs comparés à Sika Finance (référentiel SYSCOHADA) : valeurs, écarts, comparabilité.';

alter table public.comptes_ifrs enable row level security;

drop policy if exists "comptes_ifrs_public_read" on public.comptes_ifrs;
create policy "comptes_ifrs_public_read"
  on public.comptes_ifrs for select
  to anon, authenticated
  using (true);

-- Aucune policy d'écriture : seule la clé de service alimente cette table.
revoke insert, update, delete on public.comptes_ifrs from anon, authenticated;
