-- 0179 — Audience & CRM : signaux de formation et pays du compte.
-- Spec : docs/superpowers/specs/2026-11-01-audience-crm-design.md
-- Idempotente.

-- 1. Signal « formation consultée » (premier parti, comptes connectés
--    seulement, même mécanisme que « offre_vue ») : alimente le CRM pour
--    proposer la formation complète. Une ligne par compte, page et jour.
alter table public.crm_signaux drop constraint if exists crm_signaux_type_check;
alter table public.crm_signaux add constraint crm_signaux_type_check
  check (type in ('offre_vue', 'formation_vue'));

alter table public.crm_signaux drop constraint if exists crm_signaux_page_check;
alter table public.crm_signaux add constraint crm_signaux_page_check
  check (
    page in ('/pricing', '/account/plan', '/premium/upgrade')
    or page ~ '^/formations/academy(/[a-z0-9-]{1,80}){0,2}$'
  );

-- 2. Pays du compte (code ISO 3166-1 alpha-2, issu de l'en-tête de
--    géolocalisation de Vercel à la connexion). Le PAYS seul : ni ville, ni IP.
--    Finalité : segmentation CRM (Afrique / UEMOA / pays).
alter table public.profiles
  add column if not exists pays_code text null,
  add column if not exists pays_maj_le timestamptz null;

alter table public.profiles drop constraint if exists profiles_pays_code_format;
alter table public.profiles add constraint profiles_pays_code_format
  check (pays_code is null or pays_code ~ '^[A-Z]{2}$');
