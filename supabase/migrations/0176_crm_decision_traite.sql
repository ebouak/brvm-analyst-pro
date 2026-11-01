-- 0176 — CRM v2 (SP1) : décision « traite » (réponse traitée). Sans elle, une
-- personne qui a répondu restait dans « À traiter » tant qu'aucune nouvelle
-- relance n'était journalisée, même si l'exploitant lui avait répondu hors de
-- l'outil (par e-mail). Une réponse antérieure à « traite » ne compte plus.
-- Idempotente.

alter table public.crm_actions drop constraint if exists crm_actions_decision_check;
alter table public.crm_actions add constraint crm_actions_decision_check
  check (decision is null or decision in ('cloture', 'reouverture', 'echeance', 'responsable', 'reponse', 'traite'));
