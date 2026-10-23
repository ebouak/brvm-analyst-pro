-- ============================================================================
-- 0162_whatsapp_appairage_waha.sql
-- Lot D — appairage WhatsApp par la passerelle WAHA, et verrou des liaisons.
-- Spec : docs/superpowers/specs/2026-10-24-whatsapp-lot-d-design.md
--
-- 1. whatsapp_chat_id : identifiant de conversation PROUVÉ, écrit par le
--    webhook seulement après un code d'appairage envoyé depuis cette
--    conversation (même principe que telegram_chat_id, 0129). Nécessaire car
--    WAHA transmet souvent un identifiant masqué (…@lid) sans numéro.
--    RGPD : identifiant de messagerie. Finalité : livrer l'agent, les alertes
--    et dossiers demandés. Base légale : consentement (l'utilisateur envoie
--    lui-même le code). Conservation : jusqu'au déliement ou à la suppression
--    du compte (cascade). Export : notification_prefs est exporté en entier.
--
-- 2. VERROU (défaut trouvé le 2026-10-24) : la policy « owner update » laissait
--    le propriétaire écrire N'IMPORTE QUELLE colonne de sa ligne avec la clé
--    publique — y compris telegram_chat_id et whatsapp_phone, censés n'être
--    écrits qu'après appairage. Un compte pouvait y inscrire l'identifiant
--    d'un tiers (blocage de son appairage par l'index unique, messages
--    indésirables). Le déclencheur ci-dessous interdit aux rôles anon /
--    authenticated de POSER ces colonnes ; il leur permet seulement de les
--    VIDER (déliement depuis les paramètres). service_role n'est pas concerné.
--    (Fonction de déclencheur : non appelable en RPC, PostgREST n'expose pas
--    les fonctions qui renvoient `trigger`.)
--
-- 3. Essai gratuit de l'agent : 3 messages/jour (Premium inchangé à 100).
--    Le flag est partagé avec Telegram : c'est le même agent.
-- ============================================================================

alter table public.notification_prefs
  add column if not exists whatsapp_chat_id    text,
  add column if not exists whatsapp_verifie_at timestamptz;

comment on column public.notification_prefs.whatsapp_chat_id is
  'Identifiant de conversation WhatsApp (…@c.us ou …@lid) PROUVÉ par code d''appairage. Écrit par le webhook (service_role) uniquement.';

create unique index if not exists idx_notification_prefs_whatsapp_chat_id_unique
  on public.notification_prefs (whatsapp_chat_id)
  where whatsapp_chat_id is not null;

create or replace function public.notification_prefs_verrou_liaisons()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Seules les écritures faites avec la clé publique (anon / authenticated)
  -- sont contraintes ; le webhook et les workers passent en service_role.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.whatsapp_phone      := null;
    new.whatsapp_chat_id    := null;
    new.whatsapp_verifie_at := null;
    new.telegram_chat_id    := null;
    return new;
  end if;

  -- UPDATE : vider est permis (déliement), poser ou changer ne l'est pas.
  if new.whatsapp_phone is not null and new.whatsapp_phone is distinct from old.whatsapp_phone then
    new.whatsapp_phone := old.whatsapp_phone;
  end if;
  if new.whatsapp_chat_id is not null and new.whatsapp_chat_id is distinct from old.whatsapp_chat_id then
    new.whatsapp_chat_id := old.whatsapp_chat_id;
  end if;
  if new.whatsapp_verifie_at is not null and new.whatsapp_verifie_at is distinct from old.whatsapp_verifie_at then
    new.whatsapp_verifie_at := old.whatsapp_verifie_at;
  end if;
  if new.telegram_chat_id is not null and new.telegram_chat_id is distinct from old.telegram_chat_id then
    new.telegram_chat_id := old.telegram_chat_id;
  end if;
  return new;
end;
$$;

drop trigger if exists notification_prefs_verrou_liaisons on public.notification_prefs;
create trigger notification_prefs_verrou_liaisons
  before insert or update on public.notification_prefs
  for each row execute function public.notification_prefs_verrou_liaisons();

update public.feature_flags
   set quota_free = 3,
       description = 'Messages traités par l''agent conversationnel (WhatsApp et Telegram), par jour. Gratuit : questions de marché ; Premium : portefeuille et alertes en plus.'
 where code = 'whatsapp_agent';
