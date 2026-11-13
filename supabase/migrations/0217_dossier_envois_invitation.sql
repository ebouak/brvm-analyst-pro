-- 0217 — Envoi des dossiers : les comptes non Premium reçoivent une invitation.
--
-- Les dossiers valeur sont réservés au Premium (0215, drapeau dossiers_valeur).
-- Un compte gratuit qui avait coché l'envoi ne reçoit plus de PDF : il reçoit
-- un e-mail d'invitation, journalisé ici sous le statut 'invitation'. Une
-- invitation présente dans le journal empêche la suivante ; la purge à 90 jours
-- (0132) en fait au plus une par trimestre.
--
-- RGPD : aucune donnée nouvelle (même table, mêmes colonnes, même rétention,
-- même RLS : lecture owner, écriture service_role). Base légale inchangée :
-- l'utilisateur a demandé cet envoi ; le message lui dit comment l'arrêter.

alter table public.dossier_envois drop constraint if exists dossier_envois_statut_check;
alter table public.dossier_envois
  add constraint dossier_envois_statut_check
  check (statut in ('en_cours', 'envoye', 'echec', 'vide', 'invitation'));
