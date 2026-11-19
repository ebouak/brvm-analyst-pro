-- ============================================================================
-- 0250_appels_vocaux.sql — Appels vocaux Bland (NON APPLIQUÉE par l'agent)
--
-- Deux usages, décidés par l'exploitant le 2026-11-19 :
--   * usage 2 : rappel MANUEL, depuis /admin/contact, d'une personne qui a
--     laissé un numéro ET coché la case de rappel vocal (consentement distinct) ;
--   * usage 4 : appel vocal à l'exploitant pour une alerte CRITIQUE.
-- Usages 1 (ligne entrante) et 3 (rappel de session par cron) : REPORTÉS.
--
-- RGPD (docs/RGPD.md) :
--   Données : numéro de téléphone (contact_messages.telephone, en clair, pour
--   pouvoir rappeler), empreinte HMAC du numéro (appels_vocaux,
--   oppositions_vocales), transcription de l'appel.
--   Finalité : rappeler la personne qui l'a demandé ; prévenir l'exploitant.
--   Base légale : consentement (case décochée par défaut, horodatée).
--   Sous-traitant : Bland (États-Unis) reçoit le numéro et la voix.
--   Conservation : transcription 30 jours ; métadonnées d'appel 12 mois ;
--   numéro = rétention de contact_messages (12 mois après la dernière
--   activité) ; liste d'opposition conservée (empreinte seule), comme
--   crm_oppositions.
--   Accès : service_role SEUL — RLS activée, AUCUNE policy.
-- ============================================================================

-- ── 1. Numéro et consentement sur contact_messages ─────────────────────────
alter table public.contact_messages
  add column if not exists telephone text,
  add column if not exists rappel_vocal_consent_at timestamptz;

alter table public.contact_messages drop constraint if exists contact_messages_telephone_e164_chk;
alter table public.contact_messages add constraint contact_messages_telephone_e164_chk
  check (telephone is null or telephone ~ '^\+[1-9][0-9]{7,14}$');

-- Pas de numéro sans consentement daté : sans case cochée, le numéro n'est
-- pas enregistré (la route le jette ; la base le refuse aussi).
alter table public.contact_messages drop constraint if exists contact_messages_telephone_consent_chk;
alter table public.contact_messages add constraint contact_messages_telephone_consent_chk
  check (telephone is null or rappel_vocal_consent_at is not null);

-- ── 2. Journal des appels — AUCUN numéro en clair ───────────────────────────
create table if not exists public.appels_vocaux (
  id                       uuid primary key default gen_random_uuid(),
  motif                    text not null check (motif in ('rappel_contact', 'alerte_exploitant')),
  -- rappel_contact : contact_messages.id ;
  -- alerte_exploitant : '<type>:<fenêtre de 6 h>' (voir lib/voix/fenetre.ts).
  source_id                text not null,
  numero_hash              text not null check (numero_hash ~ '^[0-9a-f]{64}$'),
  bland_call_id            text unique,
  statut                   text not null default 'en_cours'
    check (statut in ('en_cours', 'peut_etre_parti', 'en_file', 'termine', 'echec', 'non_decroche')),
  duree_min                numeric,
  prix                     numeric,
  fin_par                  text,
  transcription            text,
  transcription_purgee_le  timestamptz,
  erreur                   text,
  cree_par                 uuid references auth.users(id) on delete set null,
  cree_le                  timestamptz not null default now(),
  maj_le                   timestamptz not null default now()
);

-- Refroidissement des alertes EN BASE : un seul appel par type et par
-- fenêtre de 6 h. L'insertion passe en premier ; un conflit = déjà appelé.
create unique index if not exists appels_vocaux_alerte_unique
  on public.appels_vocaux (motif, source_id)
  where motif = 'alerte_exploitant';

create index if not exists appels_vocaux_source_idx on public.appels_vocaux (source_id, cree_le desc);
create index if not exists appels_vocaux_cree_idx   on public.appels_vocaux (cree_le desc);
create index if not exists appels_vocaux_statut_idx on public.appels_vocaux (statut, cree_le);

alter table public.appels_vocaux enable row level security;
revoke all on table public.appels_vocaux from public, anon, authenticated;

comment on table public.appels_vocaux is
  'Appels vocaux Bland (rappel contact, alerte exploitant). service_role seul. Aucun numéro en clair. Transcription purgée à 30 j, ligne à 12 mois.';

-- ── 3. Oppositions aux appels vocaux ────────────────────────────────────────
-- crm_oppositions est indexée par e-mail : un numéro ne s'y range pas. Table
-- propre, par empreinte, conservée comme la liste d'opposition du CRM.
create table if not exists public.oppositions_vocales (
  numero_hash  text primary key check (numero_hash ~ '^[0-9a-f]{64}$'),
  source       text not null check (source in ('appel', 'support', 'admin')),
  cree_le      timestamptz not null default now()
);
alter table public.oppositions_vocales enable row level security;
revoke all on table public.oppositions_vocales from public, anon, authenticated;

comment on table public.oppositions_vocales is
  'Numéros (empreinte HMAC) qui ne doivent plus être appelés. service_role seul. Conservée (art. 21).';

-- ── 4. Rétention : recréée à l'identique de 0193, + appels_vocaux ──────────
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
  -- Appels vocaux (0250) : la voix est passée chez un sous-traitant américain,
  -- la transcription ne vit que 30 jours ; les métadonnées 12 mois.
  update public.appels_vocaux
     set transcription = null, transcription_purgee_le = now(), maj_le = now()
   where transcription is not null and cree_le < now() - interval '30 days';
  delete from public.appels_vocaux          where cree_le < now() - interval '12 months';
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
