-- 0206 — Saisonnalité v2, lot 2 : faits mensuels par valeur.
-- Spec docs/superpowers/specs/2026-11-10-saisonnalite-v2.md §6 ; plan
-- docs/superpowers/plans/2026-11-10-saisonnalite-v2-lot2.md.
--
-- Écrite par le scraper (service_role, `npm run saisonnalite -- --ecrire`),
-- lue par /saisonnalite et les outils Premium. Données dérivées des cours,
-- déjà publics : lecture publique assumée ; l'accès Premium reste porté par la
-- page (drapeau `saisonnalite`). Aucune donnée personnelle.

create table if not exists public.saisonnalite_mensuelle (
  code text not null references public.brvm_instruments(code) on update cascade,
  annee int not null,
  mois int not null check (mois between 1 and 12),
  rdt_prix numeric,            -- null si mois exclu
  rdt_total numeric,           -- dividende détaché réintégré ; null si exclu ou total inconnu
  rdt_marche numeric,          -- moyenne équipondérée écrêtée ±30 % des valeurs cotées
  dividende numeric,           -- montant détaché dans le mois, sinon null
  seances_cotees int not null, -- séances avec échange
  seances_marche int not null,
  valeur_echangee numeric,
  exclu text check (exclu in ('sans_echange', 'saut', 'reprise')),
  evenements jsonb not null default '[]'::jsonb,
  difficulte boolean not null default false,
  complet boolean not null,    -- false pour le mois en cours
  maj timestamptz not null default now(),
  primary key (code, annee, mois),
  -- Le coupon réintégré ne peut qu'ajouter au rendement.
  constraint saisonnalite_total_ge_prix check (rdt_total is null or rdt_prix is null or rdt_total >= rdt_prix - 1e-9),
  -- Un mois exclu n'a pas de rendement.
  constraint saisonnalite_exclu_sans_rdt check (exclu is null or (rdt_prix is null and rdt_total is null))
);

create index if not exists saisonnalite_mensuelle_annee_mois on public.saisonnalite_mensuelle (annee, mois);

alter table public.saisonnalite_mensuelle enable row level security;

drop policy if exists saisonnalite_mensuelle_lecture on public.saisonnalite_mensuelle;
create policy saisonnalite_mensuelle_lecture on public.saisonnalite_mensuelle
  for select to anon, authenticated using (true);

-- Écriture : service_role seul (contourne la RLS). Retrait explicite des droits
-- d'écriture que les privilèges par défaut de Supabase accordent.
revoke insert, update, delete, truncate on public.saisonnalite_mensuelle from anon, authenticated;
