-- ============================================================================
-- 0129_telegram_alerts.sql
-- Alertes personnelles par Telegram : lien compte ↔ conversation Telegram.
--
-- POURQUOI CETTE MIGRATION EXISTE
-- scraper/src/alerts/channels.ts envoyait toute alerte Telegram vers un unique
-- process.env.TELEGRAM_CHAT_ID — celui de l'exploitant. La page
-- /parametres/alertes annonce pourtant « notifications par email (et Telegram
-- si configuré) » : promesse intenable pour un utilisateur, dont l'alerte
-- partait dans la conversation de quelqu'un d'autre. Il faut un destinataire
-- par compte.
--
-- UNE GARANTIE PLUS FORTE QUE POUR WHATSAPP
-- whatsapp_phone est DÉCLARÉ par l'utilisateur : l'interface n'en valide que
-- le format E.164, personne ne prouve qu'il possède ce numéro (voir 0127).
-- Ici c'est l'inverse : telegram_chat_id n'est JAMAIS saisi. Il est fourni par
-- Telegram au webhook, qui ne l'écrit qu'après réception d'un code d'appairage
-- valide envoyé depuis cette conversation. La possession est donc prouvée, pas
-- supposée. Aucune écriture de cette colonne ne doit venir du client.
--
-- RGPD
--   Données collectées : identifiant de conversation Telegram (nombre) et le
--     consentement horodaté.
--   Finalité : envoyer à l'utilisateur les alertes qu'il a lui-même définies.
--   Base légale : exécution du service demandé + consentement explicite.
--   Conservation : tant que le compte existe (on delete cascade) ; codes
--     d'appairage purgés un jour après expiration.
--   Droits : couvert par GET /api/account/export et DELETE /api/account/delete.
-- ============================================================================

-- ---------------------------------------------------------------- 1. lien --

alter table public.notification_prefs
  -- bigint et non text : Telegram renvoie un entier, qui dépasse int4 pour les
  -- canaux (-100…). Le stocker en texte inviterait des comparaisons fragiles.
  add column if not exists telegram_chat_id   bigint,
  add column if not exists telegram_optin     boolean not null default false,
  add column if not exists telegram_optin_at  timestamptz,
  add column if not exists alerts_telegram    boolean not null default false,
  add column if not exists brief_telegram     boolean not null default false;

comment on column public.notification_prefs.telegram_chat_id is
  'Identifiant de conversation Telegram, écrit UNIQUEMENT par le webhook après validation d''un code d''appairage. Jamais saisi par l''utilisateur.';
comment on column public.notification_prefs.telegram_optin_at is
  'Horodatage du consentement Telegram — preuve RGPD.';

-- Index partiel : deux comptes ne peuvent pas revendiquer la même
-- conversation, et les comptes sans Telegram ne s'excluent pas entre eux.
-- Contrairement à WhatsApp, cette unicité n'est pas un pis-aller : le chat_id
-- venant de Telegram, elle empêche un vrai conflit, pas une usurpation par
-- déclaration.
create unique index if not exists idx_notification_prefs_telegram_chat_unique
  on public.notification_prefs (telegram_chat_id)
  where telegram_chat_id is not null;

-- ----------------------------------------------------------- 2. appairage --

-- Table volontairement JUMELLE de whatsapp_pairing_codes plutôt que
-- généralisée en `pairing_codes(channel, …)` : cinq colonnes, et fusionner les
-- deux obligerait à migrer un chemin de production qui fonctionne. La
-- duplication est ici plus honnête que l'abstraction.
create table if not exists public.telegram_pairing_codes (
  code        text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz
);

comment on table public.telegram_pairing_codes is
  'Codes à usage unique prouvant la possession d''une conversation Telegram : l''utilisateur envoie le code au bot, le webhook lie alors le chat_id fourni par Telegram à son compte. Expire en 15 min.';

create index if not exists idx_telegram_pairing_user
  on public.telegram_pairing_codes (user_id);

alter table public.telegram_pairing_codes enable row level security;

-- Le propriétaire lit son propre code (l'interface l'affiche). Écriture et
-- consommation : service_role uniquement — génération côté serveur, validation
-- côté webhook. Aucune policy d'insertion ni de mise à jour n'est créée, donc
-- aucun client ne peut en fabriquer un.
drop policy if exists "telegram_pairing_owner_select" on public.telegram_pairing_codes;
create policy "telegram_pairing_owner_select" on public.telegram_pairing_codes
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------- 3. conversations --

-- Table distincte de whatsapp_conversations, et non partagée : celle-ci se
-- nomme d'après son canal et sa fiche RGPD le dit. Y verser du Telegram
-- ferait mentir les deux. Le CONSENTEMENT, lui, reste commun
-- (notification_prefs.agent_optin) : c'est le même agent, quel que soit le
-- canal par lequel on lui parle.
create table if not exists public.telegram_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  contenu     text not null,
  created_at  timestamptz not null default now()
);

comment on table public.telegram_conversations is
  'Historique des échanges avec l''agent conversationnel sur Telegram. Donnée perso : contenu des messages — consentement explicite (notification_prefs.agent_optin), rétention 90 jours, cascade à la suppression du compte.';

create index if not exists idx_telegram_conversations_user_date
  on public.telegram_conversations (user_id, created_at desc);

alter table public.telegram_conversations enable row level security;

-- Le propriétaire lit son historique (l'export RGPD et les paramètres du
-- compte). Aucune policy insert/update/delete : seul le service_role écrit,
-- depuis le webhook.
drop policy if exists "telegram_conversations_owner_select" on public.telegram_conversations;
create policy "telegram_conversations_owner_select" on public.telegram_conversations
  for select using (auth.uid() = user_id);

-- --------------------------------------------------------------- 4. purge --

-- Rattachée à la fonction RGPD centralisée plutôt qu'à un second job planifié
-- (même raisonnement qu'en 0126 et 0128). Le corps est réécrit en entier :
-- create or replace ne fusionne pas, il remplace.
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
end;
$function$;

-- Les trois révocations sont nécessaires : Supabase pose un
-- ALTER DEFAULT PRIVILEGES … GRANT ALL ON FUNCTIONS TO anon, authenticated,
-- qui sont des grants NOMINATIFS. Révoquer le seul pseudo-rôle PUBLIC ne les
-- retire pas — erreur constatée en production et corrigée par 0093.
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;

comment on function public.purge_rgpd_retention is
  'Purge RGPD : supprime admin_audit_logs, notifications_log et auth_events de plus de 12 mois, whatsapp_conversations et telegram_conversations de plus de 90 jours, whatsapp_pairing_codes et telegram_pairing_codes expirés depuis plus d''un jour.';
