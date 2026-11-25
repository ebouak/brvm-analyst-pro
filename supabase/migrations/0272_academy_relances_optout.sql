-- ══════════════════════════════════════════════════════════════════════════════
-- 0272_academy_relances_optout.sql
-- Relances de progression Academy (0271) : ce qui manquait avant tout envoi réel.
--
--  1) Retrait. `notification_prefs.academy_relances` (vrai par défaut) : la case
--     de /parametres/alertes et le lien d'arrêt de chaque e-mail l'éteignent.
--     Base légale : intérêt légitime (rappel pédagogique sur un cours que la
--     personne a commencé, sans offre commerciale) ; d'où une case cochée par
--     défaut, mais un retrait possible depuis CHAQUE e-mail, en un clic.
--  2) Lien d'arrêt. `academy_reminder_logs.jeton_arret` : 48 hex aléatoires,
--     posé sur chaque envoi réel. Il désigne la personne sans exposer son
--     identifiant ni son adresse dans l'URL.
--  3) Pas de double envoi. Statut `envoi` posé AVANT l'appel à Resend : si la
--     trace ne peut pas être écrite, rien ne part ; si la mise à jour qui suit
--     échoue, la ligne reste `envoi` et compte comme « peut-être parti ».
--  4) Conservation : 6 mois (le délai entre deux rappels est de 14 jours).
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS academy_relances boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_prefs.academy_relances IS
  'Rappels de progression Academy par e-mail (route /api/cron/academy-relances). Vrai par défaut, retirable depuis /parametres/alertes ou le lien d''arrêt de chaque e-mail.';

ALTER TABLE public.academy_reminder_logs
  ADD COLUMN IF NOT EXISTS jeton_arret text;

ALTER TABLE public.academy_reminder_logs
  DROP CONSTRAINT IF EXISTS academy_reminder_logs_jeton_arret_format;
ALTER TABLE public.academy_reminder_logs
  ADD CONSTRAINT academy_reminder_logs_jeton_arret_format
  CHECK (jeton_arret IS NULL OR jeton_arret ~ '^[a-f0-9]{48}$');

CREATE UNIQUE INDEX IF NOT EXISTS academy_reminder_logs_jeton_arret_key
  ON public.academy_reminder_logs (jeton_arret) WHERE jeton_arret IS NOT NULL;

ALTER TABLE public.academy_reminder_logs
  DROP CONSTRAINT IF EXISTS academy_reminder_logs_statut_check;
ALTER TABLE public.academy_reminder_logs
  ADD CONSTRAINT academy_reminder_logs_statut_check
  CHECK (statut IN ('simulation', 'envoi', 'envoye', 'echec'));

-- Rétention : définition de production au 2026-11-25 (lue par
-- pg_get_functiondef), plus la ligne academy_reminder_logs.
CREATE OR REPLACE FUNCTION public.purge_rgpd_retention()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
  delete from public.whatsapp_conversations where user_id is null and created_at < now() - interval '30 days';
  delete from public.whatsapp_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.telegram_conversations where created_at < now() - interval '90 days';
  delete from public.telegram_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.dossier_envois         where created_at < now() - interval '90 days';
  delete from public.formation_inscriptions i
   using public.formation_sessions s
   where s.id = i.session_id and s.debut_at < now() - interval '3 years';
  delete from public.payment_webhook_events where received_at < now() - interval '12 months';
  delete from public.contact_messages       where derniere_activite_at < now() - interval '12 months';
  delete from public.crm_signaux            where created_at < now() - interval '90 days';
  delete from public.crm_actions            where created_at < now() - interval '24 months';
  delete from public.academy_exam_sessions  where created_at < now() - interval '7 days';
  delete from public.recherche_societes_cache  where cree_le < now() - interval '24 hours';
  delete from public.recherche_societes_budget where jour < current_date - 30;
  delete from public.whatsapp_aiguillages      where created_at < now() - interval '90 days';
  delete from public.jev_budget                where jour < current_date - 30;
  -- Appels vocaux (0250) : la voix est passée chez un sous-traitant américain,
  -- la transcription ne vit que 30 jours ; les métadonnées 12 mois.
  update public.appels_vocaux
     set transcription = null, transcription_purgee_le = now(), maj_le = now()
   where transcription is not null and cree_le < now() - interval '30 days';
  delete from public.appels_vocaux          where cree_le < now() - interval '12 months';
  -- Compteur d'acquisition (0251) : agrégé, sans donnée personnelle, 24 mois.
  delete from public.acquisition_compteurs  where jour < current_date - interval '24 months';
  -- Relances de progression Academy (0271/0272) : 6 mois.
  delete from public.academy_reminder_logs  where created_at < now() - interval '6 months';
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.purge_rgpd_retention() FROM public, anon, authenticated;

COMMIT;
