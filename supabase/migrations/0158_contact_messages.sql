-- ============================================================================
-- 0158_contact_messages.sql
-- Messages du formulaire de contact — spec
-- docs/superpowers/specs/2026-10-21-contact-reponses-design.md
--
-- Jusqu'ici le message n'était QUE relayé par email : rien n'en gardait trace,
-- et 4 visiteurs sur 7 n'ont jamais eu la réponse que l'accusé leur promettait.
--
-- RGPD : prénom, email, page, message. Finalité : répondre à la demande.
-- Base légale : réponse à une sollicitation volontaire (mesures
-- précontractuelles / intérêt légitime). Conservation : 12 mois après la
-- dernière activité (purge_rgpd_retention). Accès : service_role SEUL — RLS
-- activée sans aucune policy ; la console admin lit côté serveur après
-- requirePermission('support.read').
-- ============================================================================

create table if not exists public.contact_messages (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  prenom                text,
  email                 text not null,
  page                  text,
  message               text not null,
  statut                text not null default 'nouveau',
  brouillon             text,
  brouillon_at          timestamptz,
  reponse               text,
  repondu_at            timestamptz,
  repondu_par           uuid references auth.users(id) on delete set null,
  resend_id             text,
  derniere_activite_at  timestamptz not null default now(),
  constraint contact_messages_statut_chk
    check (statut in ('nouveau', 'envoi', 'repondu', 'clos', 'spam'))
);

create index if not exists contact_messages_statut_created_idx
  on public.contact_messages (statut, created_at desc);
create index if not exists contact_messages_email_idx
  on public.contact_messages (lower(email));

alter table public.contact_messages enable row level security;
-- Aucune policy : ni lecture ni écriture hors service_role.
revoke all on table public.contact_messages from anon, authenticated;

comment on table public.contact_messages is
  'Messages du formulaire de contact. service_role seul. Purge 12 mois après derniere_activite_at.';

-- ── RBAC ────────────────────────────────────────────────────────────────────
insert into public.admin_permissions (code, label) values
  ('support.read',  'Voir les messages du formulaire de contact'),
  ('support.reply', 'Répondre aux messages du formulaire de contact')
on conflict (code) do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('support.read', 'support.reply')
where r.code in ('super_admin', 'support_admin')
on conflict do nothing;

-- ── Rétention : recréée à l'identique de 0146, + contact_messages ───────────
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
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
