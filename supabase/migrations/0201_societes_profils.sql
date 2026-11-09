-- 0201 — Profil des sociétés cotées : présentation, métiers, dirigeants, actionnariat.
--
-- Règle de source (décision de l'exploitant, 2026-11-09) : « officiel d'abord ».
-- Un dirigeant n'est enregistré que s'il est confirmé par une source officielle
-- (brvm.org, l'émetteur, la BCEAO, l'État) ; un actionnariat seulement s'il est
-- publié par la BRVM ou l'émetteur et daté de 2023 ou après. La présentation est
-- un texte RÉÉCRIT (pas de recopie d'un tiers). Aucun numéro de téléphone.
--
-- RGPD : les noms et fonctions des dirigeants sont des données personnelles
-- publiques (mandataires sociaux). Finalité : information de l'investisseur.
-- Base légale : intérêt légitime. Conservation : tant que la fonction est
-- exercée ; une ligne périmée est remplacée, pas archivée.

create table if not exists public.societes_profils (
  code               text primary key references public.brvm_instruments(code) on update cascade,
  presentation       text,
  metiers            text[] not null default '{}',
  determinants       text[] not null default '{}',
  dirigeants         jsonb  not null default '[]'::jsonb,  -- [{nom, fonction, depuis, source}]
  actionnariat       jsonb,                                -- {lignes:[{nom,pct}], date, source}
  site_web           text,
  verifie_le         date   not null,
  updated_at         timestamptz not null default now()
);

alter table public.societes_profils enable row level security;
drop policy if exists "lecture publique societes_profils" on public.societes_profils;
create policy "lecture publique societes_profils" on public.societes_profils
  for select using (true);
-- Écriture : service_role seulement (aucune policy d'écriture).
revoke insert, update, delete on public.societes_profils from anon, authenticated;
