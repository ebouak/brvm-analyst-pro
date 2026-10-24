-- ============================================================================
-- 0164_recap_soir.sql
-- Récap du portefeuille en image, jointe au point du soir.
-- Spec : docs/superpowers/specs/2026-10-24-recap-portefeuille-design.md
--
-- Consentement DISTINCT, décoché par défaut : l'image porte des données
-- financières personnelles (valeur, plus-value, lignes). Elle part, pour les
-- seuls comptes Premium qui l'ont cochée, sur les canaux où ils reçoivent
-- déjà le point du soir : WhatsApp (brief_whatsapp), Telegram
-- (brief_telegram), e-mail (brief_email).
-- RGPD : aucune donnée nouvelle n'est STOCKÉE — l'image est générée à la
-- volée et jamais conservée. Base légale : consentement. Retrait : décocher.
-- Le propriétaire écrit sa ligne (policy owner existante) ; le verrou de 0162
-- ne concerne pas cette colonne.
-- ============================================================================

alter table public.notification_prefs
  add column if not exists recap_soir boolean not null default false;

comment on column public.notification_prefs.recap_soir is
  'Consentement à recevoir chaque soir de séance l''image de la récap de son portefeuille avec le point du soir (WhatsApp / Telegram / e-mail). Premium. Décoché par défaut.';
