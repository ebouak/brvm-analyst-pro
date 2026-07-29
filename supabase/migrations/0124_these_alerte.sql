-- ============================================================================
-- 0124_these_alerte.sql
-- Alerte thèse invalidée (#15) :
--  - dernier_statut_evalue / derniere_alerte_le sur investment_theses :
--    mémoire du dernier statut connu pour détecter la TRANSITION vers
--    'a-revoir' (le worker ne doit notifier qu'une fois par épisode, pas à
--    chaque exécution tant que le titre reste décroché).
--  - alerts_email sur notification_prefs : opt-in personnel pour un canal
--    email en plus du WhatsApp déjà existant.
--
-- RGPD : alerts_email est un booléen de préférence, décoché par défaut
-- (consentement explicite, même discipline que alerts_whatsapp). Aucune
-- nouvelle donnée d'identification stockée : l'adresse email provient de
-- auth.users (déjà là depuis l'inscription), jamais dupliquée ici.
-- Conservation/suppression : suit notification_prefs, déjà couvert par
-- /api/account/export et /api/account/delete (select('*') → automatique).
--
-- RLS : aucune nouvelle policy — les deux tables ont déjà une RLS
-- owner-strict qui porte sur la ligne entière, colonnes incluses.
-- ============================================================================

alter table public.investment_theses
  add column if not exists dernier_statut_evalue text
       check (dernier_statut_evalue in ('intacte','a-revoir','objectif-atteint')),
  add column if not exists derniere_alerte_le timestamptz;

alter table public.notification_prefs
  add column if not exists alerts_email boolean not null default false;

comment on column public.notification_prefs.alerts_email is
  'Opt-in email pour les alertes de titres/thèses. Décoché par défaut — consentement explicite.';
