-- ============================================================================
-- 0160_contact_whatsapp.sql
-- Messages reçus sur WhatsApp (passerelle WAHA, P1) dans la même console que
-- le formulaire de contact. Spec : docs/superpowers/specs/2026-10-23-whatsapp-passerelle-design.md §7.
--
-- RGPD : nouvelle donnée personnelle = identifiant de conversation WhatsApp
-- (numéro de téléphone, ou identifiant anonyme @lid). Même finalité (répondre
-- à la demande), même conservation (12 mois après la dernière activité, purge
-- existante de 0158), même accès (service_role seul, RLS sans policy).
-- Additive et rejouable : aucune ligne existante n'est modifiée (canal = email).
-- ============================================================================

alter table public.contact_messages
  add column if not exists canal            text not null default 'email',
  add column if not exists whatsapp_chat_id text;

-- L'email n'est obligatoire que pour le canal email.
alter table public.contact_messages alter column email drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contact_messages_canal_chk') then
    alter table public.contact_messages
      add constraint contact_messages_canal_chk check (canal in ('email', 'whatsapp'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_messages_destinataire_chk') then
    alter table public.contact_messages
      add constraint contact_messages_destinataire_chk check (
        (canal = 'email' and email is not null)
        or (canal = 'whatsapp' and whatsapp_chat_id is not null)
      );
  end if;
end $$;

-- Retrouver la conversation WhatsApp en attente d'un même correspondant.
create index if not exists contact_messages_whatsapp_attente_idx
  on public.contact_messages (whatsapp_chat_id, statut)
  where canal = 'whatsapp';

comment on column public.contact_messages.canal is
  'email (formulaire du site) ou whatsapp (passerelle WAHA). La réponse repart par le même canal.';
comment on column public.contact_messages.whatsapp_chat_id is
  'Conversation WhatsApp du visiteur (…@c.us ou …@lid). Donnée personnelle, purge 12 mois.';
