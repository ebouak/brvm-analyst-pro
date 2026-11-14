-- ============================================================================
-- 0233_releve_mensuel.sql — Relevé mensuel du portefeuille (lot 6 « Rapports »)
--
-- Le relevé porte sur le portefeuille RÉEL de l'utilisateur : donnée privée.
-- Trois ajouts, tous fermés par défaut :
--
--  1. Jeton de rendu à usage unique sur monthly_reports. Le worker qui imprime
--     le PDF (video/releves.mjs) n'a pas de session : il présente un jeton
--     aléatoire dans l'en-tête `x-releve-render`. Seul le SHA-256 du jeton est
--     stocké, avec une expiration de 5 minutes ; la page le consomme dès la
--     lecture. Le jeton n'apparaît jamais dans une URL.
--     Ces deux colonnes ne sont lisibles NI par anon NI par le propriétaire :
--     la RLS filtre les lignes, pas les colonnes, d'où le retrait du SELECT de
--     table puis un SELECT accordé colonne par colonne.
--  2. Consentement distinct à l'envoi du relevé (e-mail / Telegram), décoché
--     par défaut, horodaté. WhatsApp exclu : numéro déclaratif.
--  3. Bucket de stockage PRIVÉ `releves` (<user_id>/<AAAA-MM>.pdf). Aucune
--     policy sur storage.objects : seul service_role lit et écrit ; le
--     propriétaire reçoit une URL signée de 10 minutes après contrôle de
--     session (/api/releve/[id]/pdf).
--
-- RGPD. Donnée : valeur et composition du portefeuille d'un compte. Finalité :
-- lui remettre son relevé. Base légale : exécution du service Premium pour la
-- génération et la consultation ; consentement explicite pour l'ENVOI. Durée :
-- tant que le compte existe (cascade sur auth.users) ; le PDF est supprimé du
-- bucket avec le compte (/api/account/delete). Droits : export
-- (/api/account/export, sans les colonnes de jeton) et suppression.
-- ============================================================================

-- ── 1. Jeton de rendu ──────────────────────────────────────────────────────
alter table public.monthly_reports
  add column if not exists rendu_jeton_hash   text,
  add column if not exists rendu_jeton_expire timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'monthly_reports_rendu_jeton_hash_chk') then
    alter table public.monthly_reports
      add constraint monthly_reports_rendu_jeton_hash_chk
      check (rendu_jeton_hash is null or rendu_jeton_hash ~ '^[0-9a-f]{64}$');
  end if;
end $$;

comment on column public.monthly_reports.rendu_jeton_hash is
  'SHA-256 (hex) du jeton de rendu à usage unique. service_role seul : aucun SELECT pour anon ni authenticated.';
comment on column public.monthly_reports.rendu_jeton_expire is
  'Expiration du jeton de rendu (5 minutes). Remis à null avec le hash quand la page le consomme.';

-- Le propriétaire lit ses relevés (policy RLS existante, 0030) mais ne voit
-- jamais les colonnes de jeton. Écrire reste réservé à service_role : les
-- policies INSERT/UPDATE ont été retirées en 0064, on retire aussi les droits.
revoke all on public.monthly_reports from anon, authenticated;
grant select (id, user_id, month, report_url, report_json, sent_at, created_at, updated_at)
  on public.monthly_reports to authenticated;

-- ── 2. Consentement à l'envoi du relevé ────────────────────────────────────
-- ⚠️ Verrou 0162 : aucun composant ne doit inclure telegram_chat_id,
-- whatsapp_phone ni whatsapp_chat_id dans un upsert de notification_prefs.
alter table public.notification_prefs
  add column if not exists releve_email    boolean not null default false,
  add column if not exists releve_telegram boolean not null default false,
  add column if not exists releve_optin_at timestamptz;

comment on column public.notification_prefs.releve_email is
  'Recevoir chaque mois par e-mail le relevé PDF du portefeuille. Consentement explicite.';
comment on column public.notification_prefs.releve_telegram is
  'Idem, sur la conversation Telegram appairée (telegram_chat_id). Consentement explicite.';
comment on column public.notification_prefs.releve_optin_at is
  'Première activation de l''un des deux canaux ; remis à null quand les deux sont décochés.';

-- ── 3. Bucket privé ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('releves', 'releves', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
