-- ============================================================================
-- 0087_notification_prefs.sql
-- Préférences de notification WhatsApp par utilisateur (opt-in RGPD).
--
-- RGPD : donnée perso = numéro de téléphone + horodatage du consentement.
-- Finalité : notifications demandées (brief quotidien, alertes titres).
-- Base légale : consentement explicite (case décochée par défaut côté UI).
-- Conservation : jusqu'au retrait (toggle off) ou suppression du compte
-- (on delete cascade). Couverte par /api/account/export et /api/account/delete.
--
-- Après application : lancer le scan get_advisors (security) et tester la
-- table avec la clé anon (doit renvoyer 0 ligne sans session).
-- ============================================================================

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp_phone text,             -- E.164 (+225…), null si non renseigné
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,   -- horodatage du consentement (preuve RGPD)
  brief_whatsapp boolean not null default false,   -- recevoir le brief quotidien
  alerts_whatsapp boolean not null default false,  -- recevoir les alertes titres
  updated_at timestamptz not null default now()
);

comment on table public.notification_prefs is
  'Opt-in WhatsApp par utilisateur (brief/alertes). Donnée perso : téléphone — consentement explicite, retrait libre, cascade à la suppression du compte.';

alter table public.notification_prefs enable row level security;

drop policy if exists "notification_prefs_select_own" on public.notification_prefs;
create policy "notification_prefs_select_own" on public.notification_prefs
  for select using (auth.uid() = user_id);

drop policy if exists "notification_prefs_insert_own" on public.notification_prefs;
create policy "notification_prefs_insert_own" on public.notification_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists "notification_prefs_update_own" on public.notification_prefs;
create policy "notification_prefs_update_own" on public.notification_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Pas de policy DELETE : la ligne suit le compte (cascade) ; le retrait du
-- consentement = update des booléens à false.

create or replace function public.set_notification_prefs_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_notification_prefs_updated_at() from public;

drop trigger if exists trg_notification_prefs_updated_at on public.notification_prefs;
create trigger trg_notification_prefs_updated_at
  before update on public.notification_prefs
  for each row execute function public.set_notification_prefs_updated_at();
