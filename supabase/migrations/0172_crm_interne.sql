-- 0172 — CRM interne, lot 1 (spec 2026-10-31-crm-interne-design.md).
-- Trois tables service_role : RLS activée, AUCUNE policy, revoke sur les trois
-- rôles (« from public » seul ne suffit pas — CLAUDE.md §11, migration 0093).

create table if not exists public.crm_signaux (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('offre_vue')),
  page        text not null check (page in ('/pricing', '/account/plan', '/premium/upgrade')),
  jour        date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (user_id, page, jour)
);
alter table public.crm_signaux enable row level security;
revoke all on table public.crm_signaux from public, anon, authenticated;
revoke all on sequence public.crm_signaux_id_seq from public, anon, authenticated;

create table if not exists public.crm_actions (
  id                uuid primary key default gen_random_uuid(),
  email_norm        text not null,
  user_id           uuid null references auth.users(id) on delete set null,
  type              text not null check (type in ('relance', 'note')),
  canal             text null check (canal in ('email')),
  template_id       text null,
  sujet             text null,
  contenu           text not null,
  score_at_envoi    int null,
  signaux_json      jsonb null,
  statut            text not null check (statut in ('note', 'envoi', 'envoye', 'echec')),
  erreur            text null,
  resend_id         text null,
  jeton_opposition  text null unique,
  auteur            uuid null references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists crm_actions_email_created_idx on public.crm_actions (email_norm, created_at desc);
alter table public.crm_actions enable row level security;
revoke all on table public.crm_actions from public, anon, authenticated;

create table if not exists public.crm_oppositions (
  email_norm  text primary key,
  source      text not null check (source in ('parametres', 'lien', 'admin')),
  created_at  timestamptz not null default now()
);
alter table public.crm_oppositions enable row level security;
revoke all on table public.crm_oppositions from public, anon, authenticated;

insert into public.admin_permissions (code, label) values
  ('crm.read',  'Voir le CRM (prospects, scores, fiches)'),
  ('crm.write', 'Relancer, annoter, enregistrer une opposition')
on conflict (code) do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('crm.read', 'crm.write')
where r.code in ('super_admin', 'support_admin')
on conflict do nothing;

-- ── Rétention : recréée à l'identique de 0158, + crm_signaux / crm_actions ──
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
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
