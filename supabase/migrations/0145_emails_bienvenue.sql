-- 0145 — Journal des emails de bienvenue (inscription, abonnement payant).
--
-- Un email par compte ET par motif, jamais deux : la clé primaire
-- (user_id, motif) rend l'envoi idempotent. Relancer le job ne réécrit à
-- personne. Un échec est gardé (statut 'echec', tentatives) et retenté au
-- passage suivant, au plus 3 fois.
--
-- RGPD
--   Données     : identifiant du compte, motif, statut, date, message d'erreur
--                 technique (jamais l'adresse email, déjà dans auth.users).
--   Finalité    : n'envoyer qu'une fois l'email de bienvenue lié au compte.
--   Base légale : exécution du contrat (email transactionnel d'accueil).
--   Conservation: durée de vie du compte (suppression en cascade).
--   Droits      : lecture par le titulaire (RLS), export via
--                 /api/account/export, suppression avec le compte.
--   Sécurité    : écriture réservée à service_role (job planifié).

create table if not exists public.emails_bienvenue (
  user_id    uuid not null references auth.users(id) on delete cascade,
  motif      text not null check (motif in ('inscription', 'abonnement')),
  statut     text not null check (statut in ('envoye', 'echec')),
  tentatives smallint not null default 1,
  erreur     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, motif)
);

alter table public.emails_bienvenue enable row level security;

drop policy if exists "bienvenue lisible par le titulaire" on public.emails_bienvenue;
create policy "bienvenue lisible par le titulaire"
  on public.emails_bienvenue for select
  to authenticated
  using (auth.uid() = user_id);

-- Aucune écriture côté client : ni anon ni authenticated (grants nominatifs
-- révoqués explicitement — `from public` ne suffit pas, voir 0093).
revoke insert, update, delete on public.emails_bienvenue from public, anon, authenticated;
revoke select on public.emails_bienvenue from anon;
