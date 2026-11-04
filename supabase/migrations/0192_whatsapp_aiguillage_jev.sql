-- 0192 — WhatsApp : aiguillage des messages libres par Jev (TypeSafe).
--
-- Budget générique par usage (réutilisable par d'autres chantiers Jev), journal
-- anonyme des aiguillages (ni texte ni numéro), drapeau livré COUPÉ : il ne
-- s'active qu'après une évaluation favorable. RLS activée SANS policy.

create table if not exists public.jev_budget (
  usage  text not null check (usage ~ '^[a-z_]{2,40}$'),
  jour   date not null,
  appels integer not null check (appels >= 0),
  primary key (usage, jour)
);
alter table public.jev_budget enable row level security;
revoke all on public.jev_budget from public, anon, authenticated;

create or replace function public.jev_reserver_budget(p_usage text, p_plafond integer, p_jour date default current_date)
returns boolean
language sql
set search_path = public, pg_temp
as $$
  with r as (
    insert into public.jev_budget as b (usage, jour, appels)
    select p_usage, p_jour, 1 where p_plafond > 0
    on conflict (usage, jour) do update set appels = b.appels + 1 where b.appels < p_plafond
    returning 1
  )
  select exists (select 1 from r);
$$;
revoke execute on function public.jev_reserver_budget(text, integer, date) from public, anon, authenticated;
grant execute on function public.jev_reserver_budget(text, integer, date) to service_role;

create table if not exists public.whatsapp_aiguillages (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  intention   text not null check (intention in ('cours','dividendes','palmares_hausses','palmares_baisses','palmares_volumes','aide','humain','conseil','analyse','salutation','autre')),
  decision    text not null check (decision in ('commande','clarification','refus_conseil','salutation','agent','console','aiguillage_actuel')),
  probabilite numeric not null check (probabilite >= 0 and probabilite <= 1)
);
create index if not exists idx_whatsapp_aiguillages_created_at on public.whatsapp_aiguillages (created_at);
alter table public.whatsapp_aiguillages enable row level security;
revoke all on public.whatsapp_aiguillages from public, anon, authenticated;

insert into public.feature_flags (code, label, acces, description) values
  ('whatsapp_jev', 'WhatsApp : aiguillage par Jev', 'disabled',
   'Classe les messages WhatsApp libres (Jev, TypeSafe) pour donner la réponse exacte des commandes. Livré coupé : à activer après une évaluation favorable.')
on conflict (code) do nothing;

-- Rétention : reprise de 0191 + deux lignes.
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
  delete from public.recherche_societes_cache  where cree_le < now() - interval '24 hours';
  delete from public.recherche_societes_budget where jour < current_date - 30;
  delete from public.whatsapp_aiguillages      where created_at < now() - interval '90 days';
  delete from public.jev_budget                where jour < current_date - 30;
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
