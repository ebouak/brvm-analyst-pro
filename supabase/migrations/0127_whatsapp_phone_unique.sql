-- ============================================================================
-- 0127_whatsapp_phone_unique.sql
-- Unicité du numéro WhatsApp entre comptes.
--
-- Problème corrigé (relevé pendant la revue de l'agent conversationnel) :
-- notification_prefs.whatsapp_phone n'avait aucune contrainte d'unicité, et
-- l'activation (components/settings/WhatsAppPrefs.tsx) ne valide que le
-- FORMAT E.164 — aucun code de confirmation. Deux comptes pouvaient donc
-- déclarer le même numéro avec whatsapp_optin = true.
--
-- Conséquence côté agent WhatsApp : la recherche par numéro
-- (lib/whatsappAgent/handleMessage.ts) trouve alors 2 lignes, PostgREST
-- renvoie PGRST116, et la victime reçoit « aucun compte vérifié » alors que
-- son compte existe — déni de service silencieux. Le comportement reste
-- fail-closed (aucune fuite de données entre comptes), mais l'agent devient
-- inutilisable pour le titulaire réel du numéro.
--
-- Index PARTIEL (where whatsapp_phone is not null) : les comptes sans numéro
-- renseigné ne s'excluent pas mutuellement.
--
-- ⚠️ Cet index ne remplace PAS une vraie vérification de propriété du numéro
-- (OTP). Il empêche la collision, il ne prouve pas que le déclarant possède
-- le numéro. Tant qu'aucun OTP n'existe, le premier qui enregistre un numéro
-- le bloque pour les autres — voir la note produit dans le plan de l'agent.
-- ============================================================================

-- Si des doublons existent déjà en base, la création échouera : les lister
-- avant d'appliquer, puis arbitrer manuellement lequel garder.
--   select whatsapp_phone, count(*) from public.notification_prefs
--   where whatsapp_phone is not null group by 1 having count(*) > 1;

create unique index if not exists idx_notification_prefs_whatsapp_phone_unique
  on public.notification_prefs (whatsapp_phone)
  where whatsapp_phone is not null;
