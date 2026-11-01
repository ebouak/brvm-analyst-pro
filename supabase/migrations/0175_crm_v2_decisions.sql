-- 0175 — CRM v2 (SP1) : les décisions humaines deviennent des événements de
-- crm_actions (type 'decision') : clôture + motif, réouverture, échéance,
-- responsable, réponse reçue. La plus récente l'emporte ; l'historique reste.
-- Spec : docs/superpowers/specs/2026-11-01-crm-v2-design.md §1.2, §1.4.
-- Idempotente.

alter table public.crm_actions drop constraint if exists crm_actions_type_check;
alter table public.crm_actions add constraint crm_actions_type_check
  check (type in ('relance', 'note', 'decision'));

alter table public.crm_actions drop constraint if exists crm_actions_statut_check;
alter table public.crm_actions add constraint crm_actions_statut_check
  check (statut in ('note', 'envoi', 'envoye', 'echec', 'prepare', 'decision'));

alter table public.crm_actions
  add column if not exists decision text null,
  add column if not exists motif text null,
  add column if not exists echeance date null,
  add column if not exists responsable uuid null references auth.users(id) on delete set null;

alter table public.crm_actions drop constraint if exists crm_actions_decision_check;
alter table public.crm_actions add constraint crm_actions_decision_check
  check (decision is null or decision in ('cloture', 'reouverture', 'echeance', 'responsable', 'reponse'));

alter table public.crm_actions drop constraint if exists crm_actions_motif_check;
alter table public.crm_actions add constraint crm_actions_motif_check
  check (motif is null or motif in ('pas_interesse', 'doublon', 'deja_abonne'));

-- Une décision porte son type ; une ligne non-décision n'en porte pas.
alter table public.crm_actions drop constraint if exists crm_actions_decision_coherente;
alter table public.crm_actions add constraint crm_actions_decision_coherente
  check ((type = 'decision') = (decision is not null));

-- Une clôture a un motif ; une échéance a une date.
alter table public.crm_actions drop constraint if exists crm_actions_decision_complete;
alter table public.crm_actions add constraint crm_actions_decision_complete
  check (
    (decision is distinct from 'cloture' or motif is not null)
    and (decision is distinct from 'echeance' or echeance is not null)
  );
