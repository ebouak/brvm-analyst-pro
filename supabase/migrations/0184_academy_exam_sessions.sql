-- Audit sécurité : l'examen Academy était contournable. Le serveur corrigeait les
-- réponses SOUMISES (score = bonnes / nombre de réponses envoyées) : un compte
-- pouvait n'envoyer qu'UNE réponse, lire le corrigé, la rejouer juste et obtenir
-- 100 % puis un certificat public.
--
-- Correctif : /start persiste l'examen ÉMIS (liste des questions) dans une session
-- à usage unique ; /submit exige cette session (propriétaire, non expirée, non
-- consommée — consommation atomique), des réponses pour EXACTEMENT les questions
-- émises, et calcule le score sur le nombre ÉMIS.
--
-- RGPD : donnée technique éphémère liée à user_id ; finalité = intégrité de
-- l'examen ; conservation 7 jours (purge_rgpd_retention) ; suppression du compte
-- par cascade. Accès service_role SEUL : RLS activée, aucune policy.
-- Idempotent.

create table if not exists public.academy_exam_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  niveau       text not null check (niveau in ('debutant','intermediaire','avance','expert')),
  question_ids text[] not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '2 hours',
  consumed_at  timestamptz
);
create index if not exists idx_exam_sessions_user on public.academy_exam_sessions (user_id, created_at desc);
alter table public.academy_exam_sessions enable row level security;
revoke all on public.academy_exam_sessions from public, anon, authenticated;

-- Rétention : recréée à l'identique de 0172, + academy_exam_sessions (7 jours).
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
  delete from public.formation_inscriptions i
   using public.formation_sessions s
   where s.id = i.session_id and s.debut_at < now() - interval '3 years';
  delete from public.payment_webhook_events where received_at < now() - interval '12 months';
  delete from public.contact_messages       where derniere_activite_at < now() - interval '12 months';
  delete from public.crm_signaux            where created_at < now() - interval '90 days';
  delete from public.crm_actions            where created_at < now() - interval '24 months';
  delete from public.academy_exam_sessions  where created_at < now() - interval '7 days';
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
