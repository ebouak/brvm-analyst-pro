-- ============================================================================
-- 0163_dossiers_whatsapp.sql
-- Lot E — dossiers valeur du samedi sur WhatsApp (passerelle WAHA).
-- Spec : docs/superpowers/specs/2026-10-24-whatsapp-lot-e-design.md
--
-- 1. Consentement DISTINCT `dossiers_whatsapp` (décoché par défaut), comme
--    `dossiers_telegram` (0132). Envoi seulement à un WhatsApp appairé
--    (`whatsapp_chat_id`, 0162) d'un compte Premium.
-- 2. Le journal `dossier_envois` accepte le canal `whatsapp` : même
--    idempotence par (user_id, semaine, canal) — relancer n'envoie rien deux fois.
-- RGPD : aucune nouvelle donnée personnelle (un booléen de consentement, un
-- libellé de canal). Rétention et export inchangés (0132).
-- ============================================================================

alter table public.notification_prefs
  add column if not exists dossiers_whatsapp boolean not null default false;

comment on column public.notification_prefs.dossiers_whatsapp is
  'Consentement à recevoir chaque samedi les dossiers PDF du portefeuille sur WhatsApp (passerelle). Premium, WhatsApp appairé requis.';

alter table public.dossier_envois drop constraint if exists dossier_envois_canal_check;
alter table public.dossier_envois
  add constraint dossier_envois_canal_check check (canal in ('email', 'telegram', 'whatsapp'));
