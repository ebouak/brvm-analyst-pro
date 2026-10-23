-- ============================================================================
-- 0161_whatsapp_commandes.sql
-- Journal des commandes rapides WhatsApp (COURS, DIV, PALMARES, AIDE) — spec
-- docs/superpowers/specs/2026-10-23-whatsapp-lot-a-design.md §3.
--
-- Sert UNIQUEMENT à compter les commandes servies (/admin/contact). Aucune
-- donnée personnelle : ni numéro, ni identifiant de conversation, ni texte —
-- seulement le type de commande et son issue. Pas de purge RGPD nécessaire.
-- Accès : service_role seul (RLS activée sans policy).
-- ============================================================================

create table if not exists public.whatsapp_commandes (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  commande    text not null,
  resultat    text not null,
  constraint whatsapp_commandes_commande_chk
    check (commande in ('cours', 'dividendes', 'palmares', 'aide')),
  constraint whatsapp_commandes_resultat_chk
    check (resultat in ('ok', 'introuvable', 'limite', 'erreur'))
);

create index if not exists whatsapp_commandes_created_idx
  on public.whatsapp_commandes (created_at desc);

alter table public.whatsapp_commandes enable row level security;
-- Aucune policy : ni lecture ni écriture hors service_role.
revoke all on table public.whatsapp_commandes from anon, authenticated;

comment on table public.whatsapp_commandes is
  'Commandes rapides WhatsApp servies (type + issue, aucune donnée personnelle). service_role seul.';
