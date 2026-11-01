-- 0177 — CRM v2 (SP2) : réglages de la relance pilotée et statut de livraison
-- des relances e-mail.
-- Spec : docs/superpowers/specs/2026-11-01-crm-v2-design.md §2.2, §2.3.
-- Idempotente.

-- 1. Réglages : UNE ligne (id = 1). Aucune donnée personnelle. Lecture et
--    écriture service_role uniquement (RLS activée, aucune policy) : la page
--    admin passe par le serveur après requirePermission('crm.write').
create table if not exists public.crm_reglages (
  id                        smallint primary key default 1 check (id = 1),
  max_relances              int not null default 3  check (max_relances between 1 and 10),
  delai_min_jours           int not null default 7  check (delai_min_jours between 1 and 60),
  delai_suivi_jours         int not null default 7  check (delai_suivi_jours between 1 and 60),
  fenetre_conversion_jours  int not null default 30 check (fenetre_conversion_jours between 1 and 180),
  mode_sequences            text not null default 'off' check (mode_sequences in ('off', 'simulation', 'actif')),
  plafond_par_execution     int not null default 20 check (plafond_par_execution between 1 and 200),
  modifie_par               uuid null references auth.users(id) on delete set null,
  modifie_le                timestamptz not null default now()
);
alter table public.crm_reglages enable row level security;
revoke all on table public.crm_reglages from public, anon, authenticated;
insert into public.crm_reglages (id) values (1) on conflict (id) do nothing;

-- 2. Livraison des relances e-mail (même vocabulaire et même règle monotone
--    que contact_messages, migration 0159 / lib/contact/livraison.ts).
alter table public.crm_actions
  add column if not exists livraison        text null,
  add column if not exists livraison_at     timestamptz null,
  add column if not exists livraison_detail text null;

alter table public.crm_actions drop constraint if exists crm_actions_livraison_check;
alter table public.crm_actions add constraint crm_actions_livraison_check
  check (livraison is null or livraison in ('envoye', 'retarde', 'remis', 'rejete', 'spam'));

create index if not exists crm_actions_resend_id_idx on public.crm_actions (resend_id) where resend_id is not null;
