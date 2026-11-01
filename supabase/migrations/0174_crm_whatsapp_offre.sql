-- 0174 — CRM : relance WhatsApp, numéro après inscription, dossier offert.
-- Spec : docs/superpowers/specs/2026-11-01-crm-relance-whatsapp-offre-design.md
-- Idempotente.

-- 1. Préférences : numéro DÉCLARÉ (distinct de whatsapp_phone, prouvé par
--    appairage et verrouillé par 0162), consentement au recontact commercial,
--    écran d'après inscription déjà montré.
alter table public.notification_prefs
  add column if not exists telephone_declare text null,
  add column if not exists recontact_optin_at timestamptz null,
  add column if not exists ecran_whatsapp_vu_at timestamptz null;

alter table public.notification_prefs drop constraint if exists notification_prefs_telephone_declare_e164;
alter table public.notification_prefs add constraint notification_prefs_telephone_declare_e164
  check (telephone_declare is null or telephone_declare ~ '^\+[1-9][0-9]{7,14}$');

-- 2. Journal CRM : canal WhatsApp (préparé à la main par l'exploitant) et
--    jeton du dossier offert (un dossier, 14 jours).
alter table public.crm_actions drop constraint if exists crm_actions_canal_check;
alter table public.crm_actions add constraint crm_actions_canal_check check (canal in ('email', 'whatsapp'));
alter table public.crm_actions drop constraint if exists crm_actions_statut_check;
alter table public.crm_actions add constraint crm_actions_statut_check check (statut in ('note', 'envoi', 'envoye', 'echec', 'prepare'));

alter table public.crm_actions
  add column if not exists jeton_bonus text null unique,
  add column if not exists bonus_code text null,
  add column if not exists bonus_at timestamptz null;

alter table public.crm_actions drop constraint if exists crm_actions_bonus_code_format;
alter table public.crm_actions add constraint crm_actions_bonus_code_format
  check (bonus_code is null or bonus_code ~ '^[A-Z0-9]{2,8}$');

-- 3. Opposition reçue par WhatsApp (« STOP »).
alter table public.crm_oppositions drop constraint if exists crm_oppositions_source_check;
alter table public.crm_oppositions add constraint crm_oppositions_source_check check (source in ('parametres', 'lien', 'admin', 'whatsapp'));
