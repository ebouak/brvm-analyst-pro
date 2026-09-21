-- 0133 — Newsletter : rétention des inscriptions jamais confirmées (RGPD).
--
-- Contexte. Jusqu'au 2026-09-21, aucune route ne confirmait une inscription et
-- l'expéditeur de test de Resend n'écrivait qu'à l'exploitant : les inscrits de
-- la landing n'ont JAMAIS reçu de lien valide. Purger « 30 jours après
-- l'inscription » les effacerait avant qu'ils aient eu la moindre chance de
-- confirmer. La règle est donc : 30 jours après le DERNIER email de
-- confirmation réellement envoyé. Une ligne à qui rien n'a été envoyé est
-- conservée — la purger serait détruire un consentement demandé sans jamais
-- avoir posé la question.
--
-- Données : aucune nouvelle donnée personnelle ; un horodatage technique.
-- Finalité : limiter la conservation des adresses sans consentement confirmé.
-- Base légale : intérêt légitime (minimisation, art. 5.1.e).

alter table public.newsletter_subscribers
  add column if not exists confirmation_sent_at timestamptz;

comment on column public.newsletter_subscribers.confirmation_sent_at is
  'Dernier envoi de l''email de confirmation (double opt-in). Purge 30 j après si non confirmé ; null = jamais envoyé, jamais purgé.';

create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
  delete from public.whatsapp_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.telegram_conversations where created_at < now() - interval '90 days';
  delete from public.telegram_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.dossier_envois         where created_at < now() - interval '90 days';
  -- Inscriptions newsletter jamais confirmées, 30 j après le dernier email de
  -- confirmation envoyé. `confirmation_sent_at is null` = jamais sollicité : conservé.
  delete from public.newsletter_subscribers
    where confirmed = false
      and confirmation_sent_at is not null
      and confirmation_sent_at < now() - interval '30 days';
end;
$function$;

revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;

comment on function public.purge_rgpd_retention is
  'Purge RGPD : supprime admin_audit_logs, notifications_log et auth_events de plus de 12 mois, whatsapp_conversations, telegram_conversations et dossier_envois de plus de 90 jours, whatsapp_pairing_codes et telegram_pairing_codes expirés depuis plus d''un jour, et les inscriptions newsletter non confirmées 30 jours après le dernier email de confirmation envoyé. Cron mensuel (pg_cron, rgpd-retention-monthly).';
