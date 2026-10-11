-- 0150 — Rectificatif d'un envoi de dossiers valeur.
--
-- Le 2026-10-11, les dossiers envoyés le samedi précédent contenaient une
-- erreur de période (SNTS : « chiffre d'affaires en recul de 52 % » pour un CA
-- en hausse de 8,3 %). L'envoi est idempotent par (user_id, semaine, canal) :
-- c'est voulu, et il ne doit pas changer. Le rectificatif a donc sa PROPRE
-- idempotence : une date posée sur la ligne de l'envoi corrigé. Un envoi déjà
-- rectifié ne l'est jamais deux fois, même si le workflow est relancé.
--
-- Non destructive : ajout d'une colonne nullable. Donnée liée au compte, déjà
-- couverte par la RLS propriétaire de 0132, la cascade à la suppression et la
-- purge de rétention à 90 jours (purge_rgpd_retention).

alter table public.dossier_envois
  add column if not exists rectifie_le timestamptz;

comment on column public.dossier_envois.rectifie_le is
  'Date d''envoi du rectificatif (version corrigée des dossiers de cette semaine). NULL = aucun rectificatif envoyé.';

notify pgrst, 'reload schema';
