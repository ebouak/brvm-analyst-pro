-- 0132 — Envoi hebdomadaire des dossiers valeur : consentement, journal, purge.
--
-- RGPD. Finalité : recevoir chaque samedi le dossier PDF de chaque valeur
-- détenue. Base légale : consentement explicite, cases décochées par défaut.
-- Aucune donnée nouvelle : l'email vient de profiles, le chat_id de
-- l'appairage Telegram (0129). Conservation : jusqu'au retrait ou suppression
-- du compte (cascade). Export : /api/account/export (notification_prefs déjà
-- couverte ; dossier_envois ajoutée dans le même passage).

alter table public.notification_prefs
  add column if not exists dossiers_email    boolean not null default false,
  add column if not exists dossiers_telegram boolean not null default false,
  add column if not exists dossiers_optin_at timestamptz;

comment on column public.notification_prefs.dossiers_email is
  'Recevoir chaque samedi par email le dossier PDF de chaque valeur détenue. Consentement explicite.';
comment on column public.notification_prefs.dossiers_telegram is
  'Idem, sur la conversation Telegram appairée (telegram_chat_id). Consentement explicite.';
comment on column public.notification_prefs.dossiers_optin_at is
  'Première activation de l''un des deux canaux ; remis à null quand les deux sont décochés.';

-- ── Journal des envois : l'idempotence du samedi ─────────────────────────
-- Un (compte, semaine, canal) en `envoye` n'est jamais renvoyé, même si le
-- workflow est relancé à la main. `semaine` = lundi ISO de la semaine d'envoi.
create table if not exists public.dossier_envois (
  user_id    uuid not null references auth.users(id) on delete cascade,
  semaine    date not null,
  canal      text not null check (canal in ('email', 'telegram')),
  codes      text[] not null default '{}',
  statut     text not null check (statut in ('en_cours', 'envoye', 'echec', 'vide')),
  erreur     text,
  created_at timestamptz not null default now(),
  primary key (user_id, semaine, canal)
);

comment on table public.dossier_envois is
  'Journal des envois hebdomadaires de dossiers valeur. Idempotence par (user_id, semaine, canal). Donnée perso liée au compte : lecture owner, écriture service_role, rétention 90 jours, cascade à la suppression.';

alter table public.dossier_envois enable row level security;

drop policy if exists "dossier_envois_select_own" on public.dossier_envois;
create policy "dossier_envois_select_own" on public.dossier_envois
  for select using (auth.uid() = user_id);
-- Pas de policy insert/update/delete : seul service_role écrit (job scraper).

-- ── Purge 90 jours, dans la fonction de rétention existante (0129) ────────
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
end;
$function$;

revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;

comment on function public.purge_rgpd_retention is
  'Purge RGPD : supprime admin_audit_logs, notifications_log et auth_events de plus de 12 mois, whatsapp_conversations, telegram_conversations et dossier_envois de plus de 90 jours, whatsapp_pairing_codes et telegram_pairing_codes expirés depuis plus d''un jour.';
