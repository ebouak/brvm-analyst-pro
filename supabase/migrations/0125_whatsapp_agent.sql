-- ============================================================================
-- 0125_whatsapp_agent.sql
-- Agent conversationnel WhatsApp — historique de conversation, consentement
-- RGPD distinct de l'opt-in brief/alertes (0087), et gate d'accès par plan
-- via feature_flags (0091).
--
-- RGPD : donnée perso = contenu des messages échangés avec l'agent. Finalité :
-- répondre aux questions de l'utilisateur avec mémoire conversationnelle
-- courte. Base légale : consentement explicite distinct (agent_optin).
-- Conservation : 90 jours (purge ajoutée à purge_rgpd_retention(), voir
-- migration 0126). Couverte par /api/account/export et /api/account/delete.
--
-- Après application : lancer le scan get_advisors (security) et tester la
-- table avec la clé anon (doit renvoyer 0 ligne sans session).
-- ============================================================================

-- ── 1. Historique de conversation ────────────────────────────────────────────
create table if not exists public.whatsapp_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  contenu     text not null,
  created_at  timestamptz not null default now()
);

comment on table public.whatsapp_conversations is
  'Historique des échanges avec l''agent conversationnel WhatsApp. Donnée perso : contenu des messages — consentement explicite (notification_prefs.agent_optin), rétention 90 jours, cascade à la suppression du compte.';

create index if not exists idx_whatsapp_conversations_user
  on public.whatsapp_conversations (user_id, created_at desc);

alter table public.whatsapp_conversations enable row level security;

-- Lecture par le propriétaire uniquement (ex. futur historique visible dans
-- les paramètres du compte). Pas de policy insert/update/delete pour
-- anon/authenticated : seul service_role écrit (le webhook tourne côté
-- serveur avec la clé service_role).
drop policy if exists "whatsapp_conversations_owner_select" on public.whatsapp_conversations;
create policy "whatsapp_conversations_owner_select" on public.whatsapp_conversations
  for select using (auth.uid() = user_id);

-- ── 2. Consentement distinct sur notification_prefs ──────────────────────────
alter table public.notification_prefs
  add column if not exists agent_optin boolean not null default false,
  add column if not exists agent_optin_at timestamptz;

comment on column public.notification_prefs.agent_optin is
  'Consentement DISTINCT de whatsapp_optin : autorise l''agent conversationnel à garder l''historique des échanges (90 jours). Ne pas confondre avec l''opt-in brief/alertes.';

-- ── 3. Gate d'accès + quota par plan ─────────────────────────────────────────
insert into public.feature_flags (code, label, acces, quota_free, quota_premium, description)
values (
  'whatsapp_agent',
  'Agent WhatsApp',
  'free',
  10,
  100,
  'Nombre de messages traités par l''agent conversationnel WhatsApp, par jour.'
)
on conflict (code) do nothing;
