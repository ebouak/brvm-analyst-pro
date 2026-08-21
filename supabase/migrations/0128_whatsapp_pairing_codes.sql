-- ============================================================================
-- 0128_whatsapp_pairing_codes.sql
-- Codes d'appairage à usage unique pour lier un numéro WhatsApp à un compte.
--
-- RGPD : donnée perso = aucune (le code ne contient pas le numéro ; c'est le
-- webhook qui écrit le numéro dans notification_prefs après validation).
-- Conservation : 15 minutes d'usage + purge des codes expirés par
-- purge_rgpd_retention(). Base légale : exécution du service demandé.
-- ============================================================================

create table if not exists public.whatsapp_pairing_codes (
  code        text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz
);

comment on table public.whatsapp_pairing_codes is
  'Codes à usage unique prouvant la possession d''un numéro WhatsApp : l''utilisateur envoie le code depuis son WhatsApp, le webhook lie alors le numéro fourni par Meta à son compte. Expire en 15 min.';

create index if not exists idx_whatsapp_pairing_user
  on public.whatsapp_pairing_codes (user_id);

alter table public.whatsapp_pairing_codes enable row level security;

-- Le propriétaire lit son propre code (l'interface l'affiche). Écriture et
-- consommation : service_role uniquement (génération côté serveur, validation
-- côté webhook).
drop policy if exists "whatsapp_pairing_owner_select" on public.whatsapp_pairing_codes;
create policy "whatsapp_pairing_owner_select" on public.whatsapp_pairing_codes
  for select using (auth.uid() = user_id);

-- Purge des codes expirés : rattachée à la fonction RGPD centralisée
-- existante plutôt qu'à un second job planifié (même raisonnement que 0126).
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
end;
$function$;

revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;

-- create or replace conserve l'OID, donc le commentaire posé en 0126 survit
-- et décrirait une fonction qui fait désormais une purge de plus. Réémis ici
-- pour que \df+ ne mente pas.
comment on function public.purge_rgpd_retention is
  'Purge RGPD : supprime admin_audit_logs, notifications_log et auth_events de plus de 12 mois, whatsapp_conversations de plus de 90 jours, whatsapp_pairing_codes expirés depuis plus d''un jour.';
