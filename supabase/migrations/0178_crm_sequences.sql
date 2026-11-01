-- 0178 — CRM v2 (SP3) : séquences automatiques de relance (e-mail seulement).
-- Spec : docs/superpowers/specs/2026-11-01-crm-v2-design.md §SP3.
-- - statut 'simulation' : le passage a journalisé ce qu'il AURAIT envoyé,
--   sans rien envoyer (mode_sequences = 'simulation') ;
-- - sequence_cle '<sequence>:<etape>' + index unique partiel : une étape n'est
--   jamais envoyée (ni simulée) deux fois pour une personne, même si le cron
--   est relancé. Les relances manuelles ont sequence_cle NULL (non concernées).
-- Idempotente.

alter table public.crm_actions drop constraint if exists crm_actions_statut_check;
alter table public.crm_actions add constraint crm_actions_statut_check
  check (statut in ('note', 'envoi', 'envoye', 'echec', 'prepare', 'decision', 'simulation'));

alter table public.crm_actions
  add column if not exists sequence_cle text null;

alter table public.crm_actions drop constraint if exists crm_actions_sequence_cle_format;
alter table public.crm_actions add constraint crm_actions_sequence_cle_format
  check (sequence_cle is null or sequence_cle ~ '^[a-z_]+:[0-9]+$');

create unique index if not exists crm_actions_sequence_unique
  on public.crm_actions (email_norm, sequence_cle)
  where sequence_cle is not null;
