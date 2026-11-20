-- ============================================================================
-- 0251_acquisition_compteurs.sql — Compteur agrégé des liens de suivi
-- (NON APPLIQUÉE par l'agent)
--
-- But : savoir quelles sources (affiche, délégué de classe, bouton du site…)
-- amènent des abonnés à la Chaîne WhatsApp, au canal Telegram et des
-- inscriptions. Routes /chaine et /telegram (comptent puis 302), paramètre
-- ?src= aussi accepté sur /signup.
--
-- RGPD (docs/RGPD.md) :
--   Données : AUCUNE donnée personnelle. Une ligne = (étiquette de campagne,
--   jour, type d'événement, nombre). Ni IP, ni identifiant, ni cookie, ni
--   User-Agent, ni lien avec un compte. `src` est une étiquette choisie par
--   l'exploitant (« affiche », « delegue-<ecole>-<classe> »), validée
--   ^[a-z0-9-]{1,40}$ ; elle ne doit JAMAIS porter un nom de personne.
--   Finalité : mesure d'audience agrégée des campagnes d'acquisition.
--   Base légale : intérêt légitime (statistique agrégée, sans traceur).
--   Conservation : 24 mois (purge_rgpd_retention).
--   Accès : service_role SEUL — RLS activée, AUCUNE policy ; fonction
--   d'incrément révoquée pour public, anon ET authenticated.
--
-- ⚠️ ORDRE : purge_rgpd_retention() est recréée à l'identique de 0250 (qui
-- purge appels_vocaux) + une ligne. Appliquer 0250 AVANT celle-ci, sinon la
-- purge échouerait à l'exécution sur une table absente.
-- ============================================================================

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists public.acquisition_compteurs (
  src       text    not null check (src ~ '^[a-z0-9-]{1,40}$'),
  jour      date    not null,
  evenement text    not null check (evenement in ('visite_chaine', 'visite_telegram', 'inscription')),
  n         integer not null default 0 check (n >= 0),
  primary key (src, jour, evenement)
);

alter table public.acquisition_compteurs enable row level security;
revoke all on table public.acquisition_compteurs from public, anon, authenticated;

comment on table public.acquisition_compteurs is
  'Compteur AGRÉGÉ par (source de campagne, jour UTC, événement). Aucune donnée personnelle. service_role seul. Rétention 24 mois.';

-- ── 2. Incrément ────────────────────────────────────────────────────────────
-- Appelée côté serveur (service_role) par /chaine, /telegram et la fin
-- d'inscription. Une source invalide devient « inconnu » (même règle que
-- lib/acquisition/suivi.ts). Plafond anti-remplissage : au-delà de 300 sources
-- distinctes dans la journée, toute NOUVELLE source est rangée sous
-- « debordement » — un script qui invente des src ne peut pas gonfler la table.
create or replace function public.acquisition_incrementer(p_src text, p_evenement text)
returns void
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_src  text := lower(btrim(coalesce(p_src, '')));
  v_jour date := (now() at time zone 'UTC')::date;
begin
  if p_evenement not in ('visite_chaine', 'visite_telegram', 'inscription') then
    raise exception 'acquisition_incrementer : événement inconnu %', p_evenement;
  end if;
  if v_src !~ '^[a-z0-9-]{1,40}$' then
    v_src := 'inconnu';
  end if;
  if not exists (select 1 from public.acquisition_compteurs where src = v_src and jour = v_jour)
     and (select count(distinct src) from public.acquisition_compteurs where jour = v_jour) >= 300 then
    v_src := 'debordement';
  end if;
  insert into public.acquisition_compteurs as a (src, jour, evenement, n)
  values (v_src, v_jour, p_evenement, 1)
  on conflict (src, jour, evenement) do update set n = a.n + 1;
end;
$function$;
revoke execute on function public.acquisition_incrementer(text, text) from public, anon, authenticated;
grant execute on function public.acquisition_incrementer(text, text) to service_role;

-- ── 3. Rétention : recréée à l'identique de 0250, + acquisition_compteurs ──
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
  -- Compteur d'acquisition (0251) : agrégé, sans donnée personnelle, 24 mois.
  delete from public.acquisition_compteurs  where jour < current_date - interval '24 months';
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
