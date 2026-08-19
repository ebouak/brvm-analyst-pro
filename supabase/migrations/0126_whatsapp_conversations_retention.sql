-- ============================================================================
-- 0126_whatsapp_conversations_retention.sql
-- Ajoute whatsapp_conversations (90 jours) à la purge RGPD centralisée.
-- Voir 0094 pour le raisonnement : une seule fonction planifiée, pas de
-- second calendrier de rétention à maintenir en parallèle.
-- ============================================================================

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
end;
$function$;

revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;

comment on function public.purge_rgpd_retention is
  'Purge RGPD : supprime admin_audit_logs, notifications_log et auth_events de plus de 12 mois, whatsapp_conversations de plus de 90 jours.';
