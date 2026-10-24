-- ============================================================================
-- 0165_whatsapp_liaisons.sql
-- Plusieurs WhatsApp par compte (au plus 2) — spec
-- docs/superpowers/specs/2026-10-24-whatsapp-multi-design.md
--
-- Jusqu'ici l'identifiant prouvé vivait dans UNE colonne
-- (notification_prefs.whatsapp_chat_id, 0162) : un compte ne pouvait lier
-- qu'un WhatsApp. Désormais, une ligne par WhatsApp lié. Chacun reçoit tout
-- (point du soir, alertes, dossiers, récap) et peut écrire RECAP, les
-- commandes ou à l'assistant. Les CONSENTEMENTS restent au niveau du compte
-- (notification_prefs : whatsapp_optin, brief_whatsapp, alerts_whatsapp…).
--
-- RGPD : identifiant de messagerie (et numéro quand WhatsApp le fournit).
-- Finalité : livrer les envois demandés. Base légale : consentement (code
-- d'appairage envoyé depuis ce WhatsApp). Conservation : jusqu'au déliement
-- ou à la suppression du compte (cascade). Export : /api/account/export.
-- Accès : le propriétaire LIT et SUPPRIME (déliement) ses lignes ; seul le
-- webhook (service_role) en CRÉE, après un code valide — jamais le client.
-- ============================================================================

create table if not exists public.whatsapp_liaisons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  chat_id    text not null,
  telephone  text,
  lie_le     timestamptz not null default now(),
  constraint whatsapp_liaisons_chat_unique unique (chat_id)
);

create index if not exists whatsapp_liaisons_user_idx on public.whatsapp_liaisons (user_id);

comment on table public.whatsapp_liaisons is
  'WhatsApp liés à un compte (au plus 2), chacun PROUVÉ par code d''appairage. Créés par le webhook (service_role) ; le propriétaire lit et délie.';

alter table public.whatsapp_liaisons enable row level security;
revoke all on table public.whatsapp_liaisons from anon;
revoke insert, update on table public.whatsapp_liaisons from authenticated;
grant select, delete on table public.whatsapp_liaisons to authenticated;

drop policy if exists whatsapp_liaisons_owner_select on public.whatsapp_liaisons;
create policy whatsapp_liaisons_owner_select on public.whatsapp_liaisons
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists whatsapp_liaisons_owner_delete on public.whatsapp_liaisons;
create policy whatsapp_liaisons_owner_delete on public.whatsapp_liaisons
  for delete to authenticated using (auth.uid() = user_id);

-- Reprise des liaisons existantes (0162) : rien n'est perdu.
insert into public.whatsapp_liaisons (user_id, chat_id, telephone, lie_le)
select user_id, whatsapp_chat_id, whatsapp_phone, coalesce(whatsapp_verifie_at, now())
from public.notification_prefs
where whatsapp_chat_id is not null
on conflict (chat_id) do nothing;

comment on column public.notification_prefs.whatsapp_chat_id is
  'OBSOLÈTE depuis 0165 : les WhatsApp liés vivent dans whatsapp_liaisons. Conservée pour compatibilité.';
