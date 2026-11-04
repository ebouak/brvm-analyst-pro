-- 0193 — WhatsApp : vrai chatbot (spec 2026-11-04-whatsapp-chatbot-design.md).
--
-- whatsapp_conversations devient la mémoire de TOUTE conversation, liée à un
-- compte ou non : user_id devient facultatif, chat_hash (HMAC du chatId,
-- pseudonyme) identifie la conversation. Drapeau livré COUPÉ. Rétention :
-- 30 jours sans compte, 90 jours avec (inchangé). RLS : inchangée, sans policy.

alter table public.whatsapp_conversations alter column user_id drop not null;

alter table public.whatsapp_conversations
  add column if not exists chat_hash text check (chat_hash is null or chat_hash ~ '^[0-9a-f]{64}$');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_conversations_proprietaire') then
    alter table public.whatsapp_conversations
      add constraint whatsapp_conversations_proprietaire check (user_id is not null or chat_hash is not null);
  end if;
end $$;

create index if not exists idx_whatsapp_conversations_chat
  on public.whatsapp_conversations (chat_hash, created_at desc)
  where chat_hash is not null;

comment on table public.whatsapp_conversations is
  'Mémoire des conversations WhatsApp avec l''assistant. user_id si la conversation est liée à un compte (export, cascade), chat_hash = HMAC du chatId (pseudonyme). Rétention 30 j sans compte, 90 j avec. Effaçable par la commande EFFACER.';

insert into public.feature_flags (code, label, acces, description) values
  ('whatsapp_chatbot', 'WhatsApp : assistant ouvert à tous', 'disabled',
   'Toute personne qui écrit discute avec l''assistant IA (données de marché, notions, mémoire, notes vocales). Livré coupé : activer après l''évaluation.')
on conflict (code) do nothing;

-- Rétention : reprise de 0192 + une ligne (conversations sans compte, 30 jours).
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
  delete from public.whatsapp_conversations where user_id is null and created_at < now() - interval '30 days';
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
