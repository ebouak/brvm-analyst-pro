-- ============================================================================
-- 0159_contact_livraison.sql
-- Statut de LIVRAISON des réponses du formulaire de contact.
--
-- « Envoyé » ne prouve pas « reçu » : une adresse mal saisie, une boîte pleine
-- ou un filtre anti-spam font croire à une réponse partie. Resend signale
-- chaque étape par webhook signé (/api/webhooks/resend) ; on garde ici le
-- statut le plus avancé, sans jamais le faire reculer :
--   envoye < retarde < remis < rejete < spam
--
-- Additive et rejouable. Aucune donnée nouvelle sur le visiteur hors la raison
-- d'un rejet (texte du serveur destinataire, borné à 300 caractères). La RLS
-- de contact_messages (aucune policy, service_role seul) s'applique.
-- ============================================================================

alter table public.contact_messages
  add column if not exists livraison           text,
  add column if not exists livraison_at        timestamptz,
  add column if not exists livraison_detail    text,
  add column if not exists livraison_alerte_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contact_messages_livraison_chk') then
    alter table public.contact_messages
      add constraint contact_messages_livraison_chk
      check (livraison is null or livraison in ('envoye', 'retarde', 'remis', 'rejete', 'spam'));
  end if;
end $$;

create index if not exists contact_messages_resend_id_idx
  on public.contact_messages (resend_id) where resend_id is not null;

comment on column public.contact_messages.livraison is
  'Dernier statut Resend de la réponse (webhook signé) : envoye < retarde < remis < rejete < spam. Ne recule jamais.';
comment on column public.contact_messages.livraison_alerte_at is
  'Date de l''alerte Telegram envoyée pour une réponse rejetée ou signalée comme spam — une seule alerte par réponse.';
